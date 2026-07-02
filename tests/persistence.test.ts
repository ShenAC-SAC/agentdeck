import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { EventEmitter } from "node:events";
import { applySchema } from "../src/hub/db";
import {
  upsertLive,
  appendEvent,
  archive,
  isUnexpected,
  listArchived,
  getArchived,
  deleteArchived,
  reconcileOnBoot,
  markResumed,
  createPersistenceListener,
} from "../src/hub/persistence";
import type { Session } from "../src/types";

function db(): Database {
  const d = new Database(":memory:");
  applySchema(d);
  return d;
}

function sess(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    agent: "claude-code",
    title: "api",
    tmuxTarget: "s1:0.0",
    cwd: "/repo",
    host: "local",
    state: "working",
    lastActivityAt: 100,
    lastSummaryLine: "hi",
    ...over,
  } as Session;
}

test("upsertLive inserts a live row and preserves started_at on re-upsert", () => {
  const d = db();
  upsertLive(d, sess({ lastActivityAt: 100 }));
  upsertLive(d, sess({ lastActivityAt: 200, state: "waiting", lastSummaryLine: "need you" }));
  const row = d.query("SELECT * FROM sessions WHERE id='s1'").get() as any;
  expect(row.status).toBe("live");
  expect(row.started_at).toBe(100);
  expect(row.last_state).toBe("waiting");
  expect(row.last_summary).toBe("need you");
});

test("upsertLive carries claude_session_id when present", () => {
  const d = db();
  upsertLive(d, sess({ claudeSessionId: "native-1" }));
  expect((d.query("SELECT claude_session_id c FROM sessions WHERE id='s1'").get() as any).c).toBe("native-1");
});

test("appendEvent writes rows in order", () => {
  const d = db();
  upsertLive(d, sess());
  appendEvent(d, "s1", 100, "working", "hi");
  appendEvent(d, "s1", 200, "waiting", "need you");
  const rows = d
    .query("SELECT state FROM session_events WHERE session_id='s1' ORDER BY at")
    .all()
    .map((r: any) => r.state);
  expect(rows).toEqual(["working", "waiting"]);
});

test("isUnexpected: reaped/died-offline while working or error", () => {
  expect(isUnexpected("reaped", "working")).toBe(true);
  expect(isUnexpected("died-offline", "error")).toBe(true);
  expect(isUnexpected("reaped", "idle")).toBe(false);
  expect(isUnexpected("closed", "working")).toBe(false);
});

test("archive flips status, stamps ended_at/reason/unexpected", () => {
  const d = db();
  upsertLive(d, sess({ state: "working" }));
  archive(d, sess({ state: "working" }), "reaped", 500);
  const row = d.query("SELECT * FROM sessions WHERE id='s1'").get() as any;
  expect(row.status).toBe("archived");
  expect(row.ended_at).toBe(500);
  expect(row.end_reason).toBe("reaped");
  expect(row.unexpected).toBe(1);
});

test("listArchived orders actionable-first then recency", () => {
  const d = db();
  archive(d, sess({ id: "shell", agent: "generic", state: "idle", lastActivityAt: 10 }), "closed", 300);
  upsertLive(d, sess({ id: "claude", claudeSessionId: "n1", state: "idle" }));
  archive(d, sess({ id: "claude", claudeSessionId: "n1", state: "idle" }), "reaped", 900);
  archive(d, sess({ id: "crash", state: "error" }), "reaped", 600);
  const ids = listArchived(d).map((r) => r.id);
  expect(ids[0]).toBe("claude");
  expect(ids[ids.length - 1]).toBe("shell");
});

test("deleteArchived removes the row and its events", () => {
  const d = db();
  upsertLive(d, sess({ id: "x" }));
  appendEvent(d, "x", 1, "working", null);
  archive(d, sess({ id: "x" }), "reaped", 100);
  expect(deleteArchived(d, "x")).toBe(true);
  expect(getArchived(d, "x")).toBeUndefined();
  expect(d.query("SELECT COUNT(*) c FROM session_events WHERE session_id='x'").get()).toEqual({ c: 0 } as any);
});

test("reconcileOnBoot archives local live rows whose tmux is gone, keeps present and remote ones", () => {
  const d = db();
  upsertLive(d, sess({ id: "alive", state: "working" }));
  upsertLive(d, sess({ id: "dead", state: "working" }));
  upsertLive(d, sess({ id: "remote", host: "ssh:box", state: "working" }));
  reconcileOnBoot(d, [sess({ id: "alive", state: "working" }), sess({ id: "fresh", state: "idle" })], 700);
  expect((d.query("SELECT status FROM sessions WHERE id='alive'").get() as any).status).toBe("live");
  expect((d.query("SELECT status FROM sessions WHERE id='fresh'").get() as any).status).toBe("live");
  expect((d.query("SELECT status FROM sessions WHERE id='remote'").get() as any).status).toBe("live");
  const dead = d.query("SELECT status,end_reason,unexpected FROM sessions WHERE id='dead'").get() as any;
  expect(dead.status).toBe("archived");
  expect(dead.end_reason).toBe("died-offline");
  expect(dead.unexpected).toBe(1);
});

test("markResumed links ancestor and descendant", () => {
  const d = db();
  archive(d, sess({ id: "old", claudeSessionId: "n1", state: "idle" }), "reaped", 100);
  upsertLive(d, sess({ id: "new" }));
  markResumed(d, "old", "new");
  expect(getArchived(d, "old")?.resumedInto).toBe("new");
  expect((d.query("SELECT parent_id FROM sessions WHERE id='new'").get() as any).parent_id).toBe("old");
});

test("listener upserts on update, appends an event only on state change, archives on remove", () => {
  const d = db();
  const bus = new EventEmitter();
  const stop = createPersistenceListener(d, bus);

  bus.emit("update", sess({ id: "L", state: "working", lastActivityAt: 1, lastSummaryLine: "a" }));
  bus.emit("update", sess({ id: "L", state: "working", lastActivityAt: 2, lastSummaryLine: "a" }));
  bus.emit("update", sess({ id: "L", state: "waiting", lastActivityAt: 3, lastSummaryLine: "b" }));
  const events = d
    .query("SELECT state FROM session_events WHERE session_id='L' ORDER BY at")
    .all()
    .map((r: any) => r.state);
  expect(events).toEqual(["working", "waiting"]);

  bus.emit("remove", sess({ id: "L", state: "waiting" }), "closed");
  expect((d.query("SELECT status FROM sessions WHERE id='L'").get() as any).status).toBe("archived");
  stop();
});
