import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Registry } from "../src/hub/registry";
import { ingestRows, parseListSessions } from "../src/remote/ingest";

function b64(value: string): string {
  return Buffer.from(value).toString("base64");
}

test("parseListSessions splits the -F rows", () => {
  const out = [
    `deck_1|claude-code|api|/repo|3|claude-code|${b64(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hi" }))}`,
    "deck_2|generic|shell|/repo|0||",
  ].join("\n");
  const rows = parseListSessions(out);
  expect(rows).toHaveLength(2);
  expect(rows[0].name).toBe("deck_1");
  expect(rows[0].eventSeq).toBe(3);
});

test("ingestRows upserts host-tagged, applies a new event once, and reaps the absent", () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  const seen = new Map<string, number>();
  const rows = parseListSessions(
    `deck_1|claude-code|api|/repo|1|claude-code|${b64(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "build it" }))}`,
  );

  ingestRows(registry, bus, "devbox", rows, seen);
  const session = registry.get("deck_1");
  expect(session?.host).toBe("devbox");
  expect(session?.state).toBe("working");

  ingestRows(registry, bus, "devbox", rows, seen);
  expect(registry.get("deck_1")?.state).toBe("working");

  let removed: string | undefined;
  bus.on("remove", (session) => (removed = session.id));
  ingestRows(registry, bus, "devbox", [], seen);
  expect(registry.get("deck_1")).toBeUndefined();
  expect(removed).toBe("deck_1");
});

test("ingestRows ignores remote tmux rows that were not spawned by deck", () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  const seen = new Map<string, number>();
  const rows = parseListSessions(["plain_shell||||||", "deck_1|claude-code|api|/repo|0||"].join("\n"));

  ingestRows(registry, bus, "devbox", rows, seen);

  expect(registry.get("plain_shell")).toBeUndefined();
  expect(registry.get("deck_1")).toBeDefined();
});

test("ingestRows drains queued remote events in sequence order", () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  const seen = new Map<string, number>();
  const queue = [
    `1,claude-code,${b64(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "build it" }))}`,
    `2,claude-code,${b64(JSON.stringify({ hook_event_name: "Stop", last_assistant_message: "done" }))}`,
  ].join(";");
  const rows = parseListSessions(`deck_1|claude-code|api|/repo|2|||${queue}`);

  ingestRows(registry, bus, "devbox", rows, seen);

  expect(registry.get("deck_1")?.state).toBe("waiting");
  expect(registry.get("deck_1")?.lastSummaryLine).toBe("done");
});
