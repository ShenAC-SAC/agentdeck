import { Registry } from "./registry";
import { makeBus } from "./events";
import { serve } from "./server";
import type { Database } from "bun:sqlite";

export interface HubOptions {
  sseHeartbeatMs?: number;
  db?: Database;
}

export function startHub(port = 8799, opts: HubOptions = {}) {
  const registry = new Registry();
  const events = makeBus();
  const server = serve(port, registry, events, opts);
  return { registry, events, stop: () => server.stop(true) };
}
