// AgentDeck desktop shell. Electron (Node) spawns the hub (Bun) as a child,
// loads the same web dashboard in a native window, and keeps a menu-bar tray
// whose badge shows how many sessions are waiting on you. The React frontend is
// unchanged — the window just points at the hub's http server.
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.DECK_PORT || 8799);
const URL = `http://localhost:${PORT}/`;
const ROOT = path.join(__dirname, "..");
const SMOKE = process.env.DECK_SMOKE === "1";
const SHOT = process.env.DECK_SHOT || ""; // path: screenshot the embedded terminal then quit
const SHOT_AGENT = process.env.DECK_SHOT_AGENT || "generic";

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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function shotTargets() {
  const overview =
    process.env.DECK_SHOT_OVERVIEW || (SHOT && !SHOT.endsWith(".png") ? `${SHOT}-overview.png` : "");
  const terminal =
    process.env.DECK_SHOT_TERMINAL || (SHOT ? (SHOT.endsWith(".png") ? SHOT : `${SHOT}-terminal.png`) : "");
  return { overview, terminal };
}

async function spawnDeckSession(agent, cwd) {
  const r = await fetch(`${URL}spawn`, {
    method: "POST",
    body: JSON.stringify({ agent, cwd }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function markWaiting(id, message) {
  const r = await fetch(`${URL}events?sessionId=${encodeURIComponent(id)}&agent=claude-code`, {
    method: "POST",
    body: JSON.stringify({ hook_event_name: "Notification", message }),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function capturePng(out) {
  if (!out) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log("SHOT saved:", out);
}

async function typeIntoTerminal(text) {
  win.focus();
  win.webContents.focus();
  for (const ch of text) {
    if (ch === "\n") {
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
    } else if (ch === "\u2028") {
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter", modifiers: ["shift"] });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter", modifiers: ["shift"] });
    } else {
      win.webContents.sendInputEvent({ type: "char", keyCode: ch });
    }
    await sleep(8);
  }
}

function runTmux(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("tmux", args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tmux exited ${code}`))));
  });
}

async function killTmuxSession(id) {
  try {
    await runTmux(["-L", "deck", "kill-session", "-t", id]);
    await sleep(500);
    await win.webContents.capturePage();
    console.log("SHOT kill-session ok:", id);
  } catch (e) {
    console.error("SHOT kill-session skipped:", id, e && e.message);
  }
}

async function runShotVerification() {
  const { overview, terminal } = shotTargets();
  const primaryAgent = ["claude-code", "codex", "opencode", "generic"].includes(SHOT_AGENT) ? SHOT_AGENT : "generic";
  let primary = null;
  let waiting = null;
  const waitingText = "Waiting for input in the web workspace";

  try {
    primary = await spawnDeckSession(primaryAgent, ROOT);
    waiting = await spawnDeckSession("generic", path.join(ROOT, "web"));

    if (overview) {
      await markWaiting(waiting.id, waitingText);
      await win.loadURL(URL);
      await sleep(1000);
      await capturePng(overview);
    }

    await win.loadURL(`${URL}?open=${encodeURIComponent(primary.id)}`);
    await sleep(1600);
    const input =
      process.env.DECK_SHOT_INPUT ||
      (primaryAgent === "generic" ? "echo AGENTDECK_EMBEDDED_INPUT_OK && pwd\n" : "/quit\n");
    await typeIntoTerminal(input);
    await sleep(primaryAgent === "generic" ? 1000 : 1800);

    win.setSize(980, 620);
    await sleep(350);
    win.setSize(1200, 820);
    await sleep(600);

    await markWaiting(waiting.id, waitingText);
    await sleep(250);
    await capturePng(terminal);
  } finally {
    if (waiting) await killTmuxSession(waiting.id);
    if (primary) await killTmuxSession(primary.id);
  }
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

function waitForWindowLoad(timeoutMs = 5000) {
  if (!win || !win.webContents.isLoading()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      win.webContents.removeListener("did-finish-load", done);
      win.webContents.removeListener("did-fail-load", done);
      resolve();
    }
    win.webContents.once("did-finish-load", done);
    win.webContents.once("did-fail-load", done);
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
  await waitForWindowLoad();

  if (SHOT) {
    // Verification: seed two workspace sessions, capture overview + embedded
    // terminal, type through the renderer, resize, kill a tmux session, quit.
    try {
      await runShotVerification();
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
