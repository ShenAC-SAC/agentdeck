#!/usr/bin/env bun
// Headless hub entry: the Electron app spawns this as a Bun child process.
// No TUI — just the HTTP hub (+ OS notifications) serving the web dashboard.
import { startHub } from "../src/hub/hub";
import { wireNotifications } from "../src/notify/notify";
import { startLivenessMonitor } from "../src/hub/liveness";
import { rehydrate } from "../src/hub/rehydrate";
import { openDb } from "../src/hub/db";
import { reconcileOnBoot, createPersistenceListener } from "../src/hub/persistence";
import { readSshHosts } from "../src/remote/hosts";
import { ensureMaster, closeMaster, runRemote } from "../src/remote/connection";
import { createRemotePoller } from "../src/remote/poller";
import { FIELDS } from "../src/remote/ingest";
import type { RemoteController } from "../src/hub/hub";
import {
  addConnectedHost,
  connectedHostsPath,
  readConnectedHosts,
  removeConnectedHost,
} from "../src/remote/connected-hosts";

const PORT = Number(process.env.DECK_PORT ?? 8799);
const db = openDb();
const pollers = new Map<string, ReturnType<typeof createRemotePoller>>();
const connectedHostStore = connectedHostsPath();
let hub!: ReturnType<typeof startHub>;
const remote: RemoteController = {
  hosts: () => readSshHosts(),
  connected: () => [...pollers.keys()],
  status: () => [...pollers.entries()].map(([host, poller]) => ({ host, reachable: poller.reachable() })),
  async connect(host: string) {
    if (pollers.has(host)) return;
    await ensureMaster(host);
    const poller = createRemotePoller(hub.registry, hub.events, host, {
      listSessions: async () => {
        const result = await runRemote(
          host,
          `tmux -L deck list-sessions -F ${JSON.stringify(FIELDS)} 2>/dev/null || true`,
        );
        return result.ok ? result.stdout : null;
      },
    });
    pollers.set(host, poller);
    await poller.pollOnce();
    poller.start();
    await addConnectedHost(connectedHostStore, host);
  },
  async disconnect(host: string) {
    pollers.get(host)?.stop();
    pollers.delete(host);
    await closeMaster(host);
    await removeConnectedHost(connectedHostStore, host);
  },
};
hub = startHub(PORT, { db, remote });
wireNotifications(hub.events);
await rehydrate(hub.registry).catch(() => {});
reconcileOnBoot(db, hub.registry.list());
const stopPersistence = createPersistenceListener(db, hub.events);
const stopLiveness = startLivenessMonitor(hub.registry, hub.events);
for (const host of await readConnectedHosts(connectedHostStore)) {
  await remote.connect(host).catch((e) => {
    console.error(`remote reconnect failed for ${host}:`, e instanceof Error ? e.message : String(e));
  });
}
console.log(`deck hub listening on :${PORT}`);

const shutdown = () => {
  stopLiveness();
  stopPersistence();
  for (const poller of pollers.values()) poller.stop();
  const hosts = [...pollers.keys()];
  pollers.clear();
  void Promise.all(hosts.map((host) => closeMaster(host))).finally(() => {
  db.close();
  hub.stop();
  process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
