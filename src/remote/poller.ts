import type { EventEmitter } from "node:events";
import type { Registry } from "../hub/registry";
import { ingestRows, parseListSessions } from "./ingest";

export function createRemotePoller(
  registry: Registry,
  events: EventEmitter,
  host: string,
  deps: { listSessions: () => Promise<string | null>; intervalMs?: number },
) {
  const seen = new Map<string, number>();
  let up = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function pollOnce(): Promise<void> {
    const out = await deps.listSessions();
    if (out == null) {
      up = false;
      return;
    }
    up = true;
    ingestRows(registry, events, host, parseListSessions(out), seen);
  }

  return {
    pollOnce,
    reachable: () => up,
    start() {
      if (!timer) timer = setInterval(() => void pollOnce(), deps.intervalMs ?? 4000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
