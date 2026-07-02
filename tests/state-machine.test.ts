import { test, expect } from "bun:test";
import { nextState } from "../src/hub/state-machine";

const at = 1;

test("turn-start -> working", () => {
  expect(nextState("idle", { type: "turn-start", sessionId: "s", at })).toBe("working");
});

test("turn-end after active work -> waiting handoff", () => {
  expect(nextState("working", { type: "turn-end", sessionId: "s", at })).toBe("waiting");
});

test("turn-end before any active work stays idle", () => {
  expect(nextState("idle", { type: "turn-end", sessionId: "s", at })).toBe("idle");
});

test("needs-input -> waiting", () => {
  expect(nextState("working", { type: "needs-input", sessionId: "s", at })).toBe("waiting");
});

test("error -> error", () => {
  expect(nextState("working", { type: "error", sessionId: "s", at })).toBe("error");
});
