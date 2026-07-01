import { Registry } from "./registry";
import { makeBus } from "./events";
import { serve } from "./server";

export function startHub(port = 8799) {
  const registry = new Registry();
  const events = makeBus();
  const server = serve(port, registry, events);
  return { registry, events, stop: () => server.stop(true) };
}
