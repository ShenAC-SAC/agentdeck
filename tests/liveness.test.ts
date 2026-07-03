import { test, expect } from "bun:test";
import { EventEmitter } from "node:events";
import { Registry } from "../src/hub/registry";
import { createLivenessSweeper } from "../src/hub/liveness";
import type { Session } from "../src/types";

const s = (id: string, over: Partial<Session> = {}): Session => ({
  id, agent: "claude-code", title: id, tmuxTarget: `${id}:0.0`, cwd: "/tmp",
  host: "local", state: "working", lastActivityAt: 0, lastSummaryLine: "", ...over,
});

test("sweep removes a session whose tmux is gone and emits remove", async () => {
  const r = new Registry(); const ev = new EventEmitter();
  r.upsert(s("alive")); r.upsert(s("dead"));
  const removed: Array<[string, string | undefined]> = [];
  ev.on("remove", (x: Session, reason?: string) => removed.push([x.id, reason]));
  const { sweep } = createLivenessSweeper(r, ev, {
    listLive: async () => new Set(["alive"]),
    capture: async () => "x", now: () => 0, stallMs: 90_000,
  });
  await sweep();
  expect(r.get("dead")).toBeUndefined();
  expect(r.get("alive")).toBeDefined();
  expect(removed).toEqual([["dead", "reaped"]]);
});

test("sweep never touches remote sessions", async () => {
  const r = new Registry(); const ev = new EventEmitter();
  r.upsert(s("remote", { host: "box" }));
  const { sweep } = createLivenessSweeper(r, ev, {
    listLive: async () => new Set<string>(), capture: async () => "x", now: () => 0, stallMs: 1,
  });
  await sweep();
  expect(r.get("remote")).toBeDefined();
});

test("sweep marks a quiet working session stale, then clears when it moves", async () => {
  const r = new Registry(); const ev = new EventEmitter();
  r.upsert(s("w"));
  let clock = 0; let pane = "same";
  const { sweep } = createLivenessSweeper(r, ev, {
    listLive: async () => new Set(["w"]), capture: async () => pane,
    now: () => clock, stallMs: 90_000,
  });
  await sweep();                       // establishes baseline at t=0
  clock = 90_000; await sweep();       // quiet past threshold -> stale
  expect(r.get("w")?.staleSince).toBe(90_000);
  pane = "changed"; clock = 120_000; await sweep(); // output moved -> cleared
  expect(r.get("w")?.staleSince).toBeUndefined();
});
