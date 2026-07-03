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

test("a thrown poll failure reaps nothing and marks unreachable", async () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  registry.upsert({
    id: "deck_1",
    agent: "claude-code",
    title: "api",
    tmuxTarget: "deck_1:0.0",
    cwd: "/repo",
    host: "devbox",
    state: "working",
    lastActivityAt: 0,
    lastSummaryLine: "",
  });
  const poller = createRemotePoller(registry, bus, "devbox", {
    listSessions: async () => {
      throw new Error("ssh timed out");
    },
  });

  await poller.pollOnce();

  expect(registry.get("deck_1")).toBeDefined();
  expect(poller.reachable()).toBe(false);
});

test("pollOnce does not start overlapping list-sessions calls", async () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  let calls = 0;
  let release!: (out: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  const poller = createRemotePoller(registry, bus, "devbox", {
    listSessions: async () => {
      calls += 1;
      return pending;
    },
  });

  const first = poller.pollOnce();
  const second = poller.pollOnce();
  await Promise.resolve();
  expect(calls).toBe(1);
  release("");
  await Promise.all([first, second]);
});

test("ignored remote sessions are not re-added from a stale poll row", async () => {
  const registry = new Registry();
  const bus = new EventEmitter();
  const poller = createRemotePoller(registry, bus, "devbox", { listSessions: async () => rowLive });

  poller.ignoreSession("deck_1");
  await poller.pollOnce();

  expect(registry.get("deck_1")).toBeUndefined();
});
