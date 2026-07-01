import { test, expect } from "bun:test";
import { detectIdle, startHeuristicPoller } from "../src/adapters/heuristic";

test("no output change beyond threshold -> idle", () => {
  expect(detectIdle("same", "same", 3000, 2000)).toBe(true);
});

test("output changed -> not idle", () => {
  expect(detectIdle("a", "b", 3000, 2000)).toBe(false);
});

test("unchanged but under threshold -> not idle yet", () => {
  expect(detectIdle("x", "x", 1000, 2000)).toBe(false);
});

test("heuristic poller tolerates a missing tmux target", async () => {
  const stop = startHeuristicPoller("missing:0.0", "missing", 9, { intervalMs: 1, thresholdMs: 1 });
  await Bun.sleep(20);
  stop();
  expect(true).toBe(true);
});
