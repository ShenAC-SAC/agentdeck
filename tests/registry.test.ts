import { test, expect } from "bun:test";
import { Registry } from "../src/hub/registry";
import type { Session } from "../src/types";

const base: Session = {
  id: "s1",
  agent: "codex",
  title: "t",
  tmuxTarget: "deck:0.0",
  cwd: "/tmp",
  host: "local",
  state: "idle",
  lastActivityAt: 0,
  lastSummaryLine: "",
};

test("applyEvent transitions state + stamps time/summary", () => {
  const r = new Registry();
  r.upsert(base);
  const s = r.applyEvent({ type: "needs-input", sessionId: "s1", at: 123, summary: "approve?" });
  expect(s?.state).toBe("waiting");
  expect(s?.lastActivityAt).toBe(123);
  expect(s?.lastSummaryLine).toBe("approve?");
});

test("applyEvent on unknown id returns undefined", () => {
  expect(new Registry().applyEvent({ type: "turn-end", sessionId: "x", at: 1 })).toBeUndefined();
});

test("list returns all", () => {
  const r = new Registry();
  r.upsert(base);
  expect(r.list().length).toBe(1);
});

const mk = (id: string, over: Partial<Session> = {}): Session => ({ ...base, id, ...over });

test("remove deletes and returns the session", () => {
  const r = new Registry();
  r.upsert(mk("a"));
  expect(r.remove("a")?.id).toBe("a");
  expect(r.get("a")).toBeUndefined();
  expect(r.remove("a")).toBeUndefined();
});

test("setStale sets and clears staleSince", () => {
  const r = new Registry();
  r.upsert(mk("a"));
  expect(r.setStale("a", 1234)?.staleSince).toBe(1234);
  expect(r.setStale("a", undefined)?.staleSince).toBeUndefined();
  expect(r.setStale("missing", 1)).toBeUndefined();
});

test("applyEvent clears a prior staleSince", () => {
  const r = new Registry();
  r.upsert(mk("a", { staleSince: 999, state: "working" }));
  const updated = r.applyEvent({ sessionId: "a", type: "turn-end", at: 5 });
  expect(updated?.staleSince).toBeUndefined();
  expect(updated?.state).toBe("idle");
});
