import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { applySchema } from "../src/hub/db";
import { upsertLive, appendEvent, archive, isUnexpected } from "../src/hub/persistence";
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
