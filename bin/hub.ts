#!/usr/bin/env bun
// Headless hub entry: the Electron app spawns this as a Bun child process.
// No TUI — just the HTTP hub (+ OS notifications) serving the web dashboard.
import { startHub } from "../src/hub/hub";
import { wireNotifications } from "../src/notify/notify";

const PORT = Number(process.env.DECK_PORT ?? 8799);
const hub = startHub(PORT);
wireNotifications(hub.events);
console.log(`deck hub listening on :${PORT}`);

const shutdown = () => {
  hub.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
