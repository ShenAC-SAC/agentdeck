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
  const ignored = new Set<string>();
  let up = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;

  async function runPoll(): Promise<void> {
    let out: string | null;
    try {
      out = await deps.listSessions();
    } catch {
      up = false;
      return;
    }
    if (out == null) {
      up = false;
      return;
    }
    up = true;
    const rows = parseListSessions(out);
    for (const id of [...ignored]) {
      if (!rows.some((row) => row.name === id)) ignored.delete(id);
    }
    ingestRows(registry, events, host, rows.filter((row) => !ignored.has(row.name)), seen);
  }

  async function pollOnce(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = runPoll().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return {
    pollOnce,
    ignoreSession(sessionId: string) {
      ignored.add(sessionId);
    },
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
