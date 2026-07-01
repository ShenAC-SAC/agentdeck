import { test, expect } from "bun:test";
import { deckSessionOptions } from "../src/hub/rehydrate";

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
