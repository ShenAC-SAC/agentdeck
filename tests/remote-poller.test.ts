import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Registry } from "../src/hub/registry";
import { createRemotePoller } from "../src/remote/poller";

function b64(value: string): string {
  return Buffer.from(value).toString("base64");
}

const rowLive = `deck_1|claude-code|api|/repo|1|claude-code|${b64(
  JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "x" }),
)}`;

test("a FAILED poll (listSessions -> null) reaps nothing and marks unreachable", async () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  let out: string | null = rowLive;
  const poller = createRemotePoller(registry, bus, "devbox", { listSessions: async () => out });

  await poller.pollOnce();
  expect(registry.get("deck_1")).toBeDefined();
  expect(poller.reachable()).toBe(true);

  out = null;
  const removes: string[] = [];
  bus.on("remove", (session) => removes.push(session.id));
  await poller.pollOnce();
  expect(registry.get("deck_1")).toBeDefined();
  expect(removes).toEqual([]);
  expect(poller.reachable()).toBe(false);

  out = "";
  await poller.pollOnce();
  expect(registry.get("deck_1")).toBeUndefined();
  expect(poller.reachable()).toBe(true);
});
