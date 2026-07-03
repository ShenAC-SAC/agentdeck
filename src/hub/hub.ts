import { Registry } from "./registry";
import { makeBus } from "./events";
import { serve } from "./server";
import type { Database } from "bun:sqlite";
import type { spawnRemoteAgent, spawnRemoteShell } from "../tmux/spawn";

export interface RemoteController {
  hosts: () => Promise<{ alias: string; hostname?: string; user?: string }[]>;
  connect: (host: string) => Promise<void>;
  disconnect: (host: string) => Promise<void>;
  connected: () => string[];
  status: () => { host: string; reachable: boolean }[];
}

export interface RemoteSpawnController {
  agent: typeof spawnRemoteAgent;
  shell: typeof spawnRemoteShell;
}

export interface HubOptions {
  sseHeartbeatMs?: number;
  db?: Database;
  remote?: RemoteController;
  remoteSpawn?: RemoteSpawnController;
}

export function startHub(port = 8799, opts: HubOptions = {}) {
  const registry = new Registry();
  const events = makeBus();
  const server = serve(port, registry, events, opts);
  return { registry, events, stop: () => server.stop(true) };
}
