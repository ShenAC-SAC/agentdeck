import type { EventEmitter } from "node:events";
import type { Registry } from "./registry";
import { tmux } from "../tmux/tmux";

// Names of every session currently alive on the private deck socket. A missing
// server (no sessions at all) means nothing is alive, not an error.
export async function liveDeckSessions(): Promise<Set<string>> {
  try {
    const out = await tmux.run(["list-sessions", "-F", "#{session_name}"]);
    return new Set(out.split("\n").map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export interface LivenessDeps {
  listLive: () => Promise<Set<string>>;
  capture: (target: string) => Promise<string>;
  now: () => number;
  stallMs: number;
}

// One pass: reap dead local sessions, then flag/clear stall on live working ones.
export function createLivenessSweeper(registry: Registry, events: EventEmitter, deps: LivenessDeps) {
  const lastPane = new Map<string, { text: string; since: number }>();
  async function sweep(): Promise<void> {
    const live = await deps.listLive();
    for (const s of registry.list()) {
      if (s.host !== "local") continue; // remote lives on another socket
      if (!live.has(s.id)) {
        const removed = registry.remove(s.id);
        lastPane.delete(s.id);
        if (removed) events.emit("remove", removed, "reaped");
        continue;
      }
      if (s.state !== "working") {
        lastPane.delete(s.id);
        continue;
      }
      const text = await deps.capture(s.tmuxTarget).catch(() => undefined);
      if (text == null) continue;
      const prev = lastPane.get(s.id);
      const now = deps.now();
      if (!prev || prev.text !== text) {
        lastPane.set(s.id, { text, since: now });
        if (s.staleSince != null) {
          const cleared = registry.setStale(s.id, undefined);
          if (cleared) events.emit("update", cleared);
        }
        continue;
      }
      if (s.staleSince == null && now - prev.since >= deps.stallMs) {
        const stale = registry.setStale(s.id, now);
        if (stale) events.emit("update", stale);
      }
    }
  }
  return { sweep };
}

export function startLivenessMonitor(
  registry: Registry,
  events: EventEmitter,
  opts: { intervalMs?: number; stallMs?: number } = {},
): () => void {
  const { sweep } = createLivenessSweeper(registry, events, {
    listLive: liveDeckSessions,
    capture: (t) => tmux.capturePane(t),
    now: () => Date.now(),
    stallMs: opts.stallMs ?? 120_000,
  });
  const timer = setInterval(() => {
    void sweep();
  }, opts.intervalMs ?? 3_000);
  return () => clearInterval(timer);
}
