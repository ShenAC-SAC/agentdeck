#!/usr/bin/env node
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ELECTRON_APP = path.join(ROOT, "node_modules", "electron", "dist", "Electron.app");
const DEV_DIR = path.join(ROOT, ".agentdeck");
const DEV_APP = path.join(DEV_DIR, "AgentDeck.app");
const DEV_EXE = path.join(DEV_APP, "Contents", "MacOS", "Electron");
const DEV_PLIST = path.join(DEV_APP, "Contents", "Info.plist");
const DEV_RESOURCES = path.join(DEV_APP, "Contents", "Resources");

function setPlistString(plist, key, value) {
  const entry = `<key>${key}</key>\n\t<string>${value}</string>`;
  const re = new RegExp(`<key>${key}</key>\\s*<string>[^<]*</string>`);
  if (re.test(plist)) return plist.replace(re, entry);
  return plist.replace("</dict>", `\t${entry}\n</dict>`);
}

function ensureDevApp() {
  if (!fs.existsSync(ELECTRON_APP)) {
    throw new Error(`Electron.app not found at ${ELECTRON_APP}`);
  }

  fs.rmSync(DEV_APP, { recursive: true, force: true });
  fs.mkdirSync(DEV_DIR, { recursive: true });
  fs.cpSync(ELECTRON_APP, DEV_APP, { recursive: true, verbatimSymlinks: true });

  fs.copyFileSync(path.join(ROOT, "electron", "assets", "icon.icns"), path.join(DEV_RESOURCES, "agentdeck.icns"));

  let plist = fs.readFileSync(DEV_PLIST, "utf8");
  plist = setPlistString(plist, "CFBundleDisplayName", "AgentDeck");
  plist = setPlistString(plist, "CFBundleName", "AgentDeck");
  plist = setPlistString(plist, "CFBundleIdentifier", "com.agentdeck.dev");
  plist = setPlistString(plist, "CFBundleIconFile", "agentdeck.icns");
  fs.writeFileSync(DEV_PLIST, plist);

  return DEV_EXE;
}

const exe = ensureDevApp();
const child = spawn(exe, [ROOT], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
