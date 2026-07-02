#!/usr/bin/env bun
// Headless hub entry: the Electron app spawns this as a Bun child process.
// No TUI — just the HTTP hub (+ OS notifications) serving the web dashboard.
import { startHub } from "../src/hub/hub";
import { wireNotifications } from "../src/notify/notify";
import { startLivenessMonitor } from "../src/hub/liveness";
import { rehydrate } from "../src/hub/rehydrate";
import { openDb } from "../src/hub/db";
import { reconcileOnBoot, createPersistenceListener } from "../src/hub/persistence";

const PORT = Number(process.env.DECK_PORT ?? 8799);
const db = openDb();
const hub = startHub(PORT, { db });
wireNotifications(hub.events);
await rehydrate(hub.registry).catch(() => {});
reconcileOnBoot(db, hub.registry.list());
const stopPersistence = createPersistenceListener(db, hub.events);
const stopLiveness = startLivenessMonitor(hub.registry, hub.events);
console.log(`deck hub listening on :${PORT}`);

const shutdown = () => {
  stopLiveness();
  stopPersistence();
  db.close();
  hub.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
