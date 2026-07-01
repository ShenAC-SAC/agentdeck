import { test, expect } from "bun:test";
import { parseListPanes } from "../src/tmux/parse";

test("parses target|title|command lines", () => {
  const raw = "deck:0.0|claude|node\ndeck:1.0|codex|node\n";
  expect(parseListPanes(raw)).toEqual([
    { target: "deck:0.0", title: "claude", command: "node" },
    { target: "deck:1.0", title: "codex", command: "node" },
  ]);
});

test("ignores blank lines", () => {
  expect(parseListPanes("\n\n")).toEqual([]);
});
