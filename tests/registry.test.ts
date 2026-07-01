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
