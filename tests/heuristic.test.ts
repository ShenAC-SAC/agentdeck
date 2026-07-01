import { test, expect } from "bun:test";
import { detectIdle } from "../src/adapters/heuristic";

test("no output change beyond threshold -> idle", () => {
  expect(detectIdle("same", "same", 3000, 2000)).toBe(true);
});

test("output changed -> not idle", () => {
  expect(detectIdle("a", "b", 3000, 2000)).toBe(false);
});

test("unchanged but under threshold -> not idle yet", () => {
  expect(detectIdle("x", "x", 1000, 2000)).toBe(false);
});
