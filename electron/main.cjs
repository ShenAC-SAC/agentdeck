// AgentDeck desktop shell. Electron (Node) spawns the hub (Bun) as a child,
// loads the same web dashboard in a native window, and keeps a menu-bar tray
// whose badge shows how many sessions are waiting on you. The React frontend is
// unchanged — the window just points at the hub's http server.
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = Number(process.env.DECK_PORT || 8799);
const URL = `http://localhost:${PORT}/`;
const ROOT = path.join(__dirname, "..");
const SMOKE = process.env.DECK_SMOKE === "1";
const SHOT = process.env.DECK_SHOT || ""; // path: screenshot the embedded terminal then quit

let hub = null;
let win = null;
let tray = null;
let pollTimer = null;
app.isQuitting = false;

// node-pty (native, rebuilt for Electron) powers the embedded terminals.
let ptyMod = null;
try {
  ptyMod = require("node-pty");
} catch (e) {
  console.error("node-pty unavailable:", e && e.message);
}
const ptys = new Map();

// Each renderer terminal maps to a pty running `tmux -L deck attach` for one
// session — tmux stays the substrate; the GUI is just another client.
function setupPty() {
  ipcMain.handle("pty:open", (_e, { id, target, cols, rows }) => {
    if (!ptyMod) return { ok: false, error: "node-pty unavailable" };
    const existing = ptys.get(id);
    if (existing) {
      try {
        existing.kill();
      } catch {}
      ptys.delete(id);
    }
    const session = String(target || id).split(":")[0];
    const shell = process.env.SHELL || "/bin/bash";
    const cmd = `tmux -L deck set -g status off 2>/dev/null; exec tmux -L deck attach -t '${session}'`;
    const p = ptyMod.spawn(shell, ["-lc", cmd], {
      name: "xterm-256color",
      cols: cols || 80,
      rows: rows || 24,
      cwd: ROOT,
      env: process.env,
    });
    p.onData((data) => {
      if (win && !win.isDestroyed()) win.webContents.send("pty:data", { id, data });
    });
    p.onExit(() => {
      ptys.delete(id);
      if (win && !win.isDestroyed()) win.webContents.send("pty:exit", { id });
    });
    ptys.set(id, p);
    return { ok: true };
  });
  ipcMain.on("pty:write", (_e, { id, data }) => {
    const p = ptys.get(id);
    if (p) p.write(data);
  });
  ipcMain.on("pty:resize", (_e, { id, cols, rows }) => {
    const p = ptys.get(id);
    if (p) {
      try {
        p.resize(cols, rows);
      } catch {}
    }
  });
  ipcMain.on("pty:close", (_e, { id }) => {
    const p = ptys.get(id);
    if (p) {
      try {
        p.kill();
      } catch {}
      ptys.delete(id);
    }
  });
}

function setupDialog() {
  ipcMain.handle("dialog:pickFolder", async () => {
    const r = await dialog.showOpenDialog(win || undefined, {
      properties: ["openDirectory", "createDirectory"],
    });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });
}

function startHub() {
  hub = spawn("bun", [path.join("bin", "hub.ts")], {
    cwd: ROOT,
    env: { ...process.env, DECK_PORT: String(PORT) },
    stdio: "inherit",
  });
  hub.on("error", (e) => console.error("failed to spawn hub (is `bun` on PATH?):", e.message));
}

async function waitForHub(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${URL}sessions`);
      if (r.ok) return true;
    } catch {
      // hub not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    title: "AgentDeck",
    backgroundColor: "#14100c",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadURL(URL);
  win.on("close", (e) => {
    // Closing hides to the tray; quit is explicit (tray menu / Cmd-Q).
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return createWindow();
  if (win.isVisible() && win.isFocused()) win.hide();
  else {
    win.show();
    win.focus();
  }
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("AgentDeck");
  tray.setTitle("⚓");
  tray.on("click", toggleWindow);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show deck", click: toggleWindow },
      { type: "separator" },
      { label: "Quit AgentDeck", click: () => quit() },
    ]),
  );
}

// Reflect the waiting count in the menu bar + dock so you can glance without
// the window open.
async function refreshBadge() {
  try {
    const sessions = await (await fetch(`${URL}sessions`)).json();
    const waiting = sessions.filter((s) => s.state === "waiting").length;
    if (tray) tray.setTitle(waiting > 0 ? `⚓ ${waiting}` : "⚓");
    if (app.dock) app.dock.setBadge(waiting > 0 ? String(waiting) : "");
  } catch {
    if (tray) tray.setTitle("⚓");
  }
}

function quit() {
  app.isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
  for (const p of ptys.values()) {
    try {
      p.kill();
    } catch {}
  }
  if (hub) hub.kill();
  app.quit();
}

app.whenReady().then(async () => {
  startHub();
  const up = await waitForHub();
  if (!up) console.error("hub did not become reachable on", URL);

  if (SMOKE) {
    console.log(up ? "SMOKE OK: hub reachable" : "SMOKE FAIL: hub unreachable");
    return quit();
  }

  setupPty();
  setupDialog();
  createTray();
  createWindow();

  if (SHOT) {
    // Verification: spawn a session, open its embedded terminal, screenshot, quit.
    try {
      const r = await fetch(`${URL}spawn`, { method: "POST", body: JSON.stringify({ agent: "generic" }) });
      const { id } = await r.json();
      await new Promise((res) => setTimeout(res, 400));
      await win.loadURL(`${URL}?open=${encodeURIComponent(id)}`);
      await new Promise((res) => setTimeout(res, 2800));
      const img = await win.webContents.capturePage();
      require("node:fs").writeFileSync(SHOT, img.toPNG());
      console.log("SHOT saved:", SHOT, "session:", id);
    } catch (e) {
      console.error("SHOT failed:", e && e.message);
    }
    return quit();
  }

  await refreshBadge();
  pollTimer = setInterval(refreshBadge, 3000);

  app.on("activate", () => toggleWindow());
});

// Tray app: keep running after the window closes.
app.on("window-all-closed", () => {});
app.on("before-quit", () => {
  app.isQuitting = true;
  if (hub) hub.kill();
});
