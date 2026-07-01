import { test, expect } from "bun:test";
import { deckSessionOptions, parseDeckSession } from "../src/hub/rehydrate";

test("deckSessionOptions maps metadata to @deck_* tmux options", () => {
  const opts = deckSessionOptions({ agent: "claude-code", cwd: "/repo", host: "local", title: "Fix auth" });
  expect(opts).toContainEqual(["@deck_agent", "claude-code"]);
  expect(opts).toContainEqual(["@deck_cwd", "/repo"]);
  expect(opts).toContainEqual(["@deck_host", "local"]);
  expect(opts).toContainEqual(["@deck_title", "Fix auth"]);
  expect(opts).toContainEqual(["@deck_title_locked", "0"]);
});

test("deckSessionOptions records a locked title", () => {
  const opts = deckSessionOptions({ agent: "generic", cwd: "/tmp", host: "local", title: "x", titleLocked: true });
  expect(opts).toContainEqual(["@deck_title_locked", "1"]);
});

test("parseDeckSession reconstructs a deck session from a list-sessions line", () => {
  const s = parseDeckSession("deck_1|claude-code|/repo|local|Fix auth|1", 1000);
  expect(s).toMatchObject({
    id: "deck_1", agent: "claude-code", cwd: "/repo", host: "local",
    title: "Fix auth", titleLocked: true, state: "idle", tmuxTarget: "deck_1:0.0",
  });
  expect(s?.lastActivityAt).toBe(1000);
});

test("parseDeckSession skips sessions not spawned by deck", () => {
  expect(parseDeckSession("random||||", 0)).toBeNull(); // no @deck_agent
  expect(parseDeckSession("x|notanagent|/r|local|t|0", 0)).toBeNull(); // bad agent
});
