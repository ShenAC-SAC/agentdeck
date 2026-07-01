import { test, expect } from "bun:test";
import type { Session } from "../src/types";

test("Session shape compiles", () => {
  const s: Session = {
    id: "a",
    agent: "codex",
    title: "t",
    tmuxTarget: "deck:0.0",
    host: "local",
    state: "idle",
    lastActivityAt: 0,
    lastSummaryLine: "",
  };
  expect(s.state).toBe("idle");
});
