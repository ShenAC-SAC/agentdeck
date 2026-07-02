import { expect, test } from "bun:test";
import { historyRowModel } from "../web/src/components/history-data";
import type { ArchivedSession } from "../web/src/types";

const base: ArchivedSession = {
  id: "a",
  agent: "claude-code",
  title: "api",
  cwd: "/r",
  host: "local",
  lastState: "error",
  lastSummary: null,
  startedAt: 0,
  endedAt: 1000,
  endReason: "reaped",
  unexpected: true,
  claudeSessionId: "n1",
};

test("claude row with a session id is resumable", () => {
  expect(historyRowModel(base).resumable).toBe(true);
});

test("generic row is never resumable", () => {
  expect(historyRowModel({ ...base, agent: "generic", claudeSessionId: undefined }).resumable).toBe(false);
});

test("error last state surfaces as its label", () => {
  expect(historyRowModel(base).stateLabel.toLowerCase()).toContain("error");
});
