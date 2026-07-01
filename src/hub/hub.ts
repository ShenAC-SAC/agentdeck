import { Registry } from "./registry";
import { makeBus } from "./events";
import { serve } from "./server";

export interface HubOptions {
  sseHeartbeatMs?: number;
}

export function startHub(port = 8799, opts: HubOptions = {}) {
  const registry = new Registry();
  const events = makeBus();
  const server = serve(port, registry, events, opts);
  return { registry, events, stop: () => server.stop(true) };
}
