// AgentDeck desktop shell. Electron (Node) spawns the hub (Bun) as a child,
// loads the same web dashboard in a native window, and keeps a menu-bar tray
// whose badge shows how many sessions are waiting on you. The React frontend is
// unchanged — the window just points at the hub's http server.
const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = Number(process.env.DECK_PORT || 8799);
const URL = `http://localhost:${PORT}/`;
const ROOT = path.join(__dirname, "..");
const SMOKE = process.env.DECK_SMOKE === "1";

let hub = null;
let win = null;
let tray = null;
let pollTimer = null;
app.isQuitting = false;

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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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

  createTray();
  createWindow();
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
