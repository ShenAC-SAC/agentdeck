import type { Database } from "bun:sqlite";
import type { EventEmitter } from "node:events";
import type { Session } from "../types";

export type EndReason = "reaped" | "closed" | "died-offline";

// Insert on first sight; on re-upsert keep started_at + archival columns, refresh
// the live snapshot. status is forced back to 'live' (a resumed/again-live id).
export function upsertLive(db: Database, s: Session): void {
  db.query(
    `INSERT INTO sessions (id, agent, title, cwd, host, status, last_state, last_summary, started_at, claude_session_id)
     VALUES (?, ?, ?, ?, ?, 'live', ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       cwd = excluded.cwd,
       status = 'live',
       last_state = excluded.last_state,
       last_summary = excluded.last_summary,
       claude_session_id = COALESCE(excluded.claude_session_id, sessions.claude_session_id)`,
  ).run(
    s.id,
    s.agent,
    s.title,
    s.cwd,
    s.host,
    s.state,
    s.lastSummaryLine ?? null,
    s.lastActivityAt,
    s.claudeSessionId ?? null,
  );
}

export function appendEvent(db: Database, sessionId: string, at: number, state: string, summary: string | null): void {
  db.query(`INSERT INTO session_events (session_id, at, state, summary) VALUES (?, ?, ?, ?)`).run(
    sessionId,
    at,
    state,
    summary,
  );
}

export function isUnexpected(reason: EndReason, lastState: string): boolean {
  return (reason === "reaped" || reason === "died-offline") && (lastState === "working" || lastState === "error");
}

// Flip a live row to archived. Row may not exist yet (session never emitted an
// update before dying) - upsert first so nothing is lost.
export function archive(db: Database, s: Session, reason: EndReason, at: number = Date.now()): void {
  upsertLive(db, s);
  db.query(
    `UPDATE sessions SET status='archived', ended_at=?, end_reason=?, unexpected=?, last_state=?, last_summary=?
     WHERE id=?`,
  ).run(at, reason, isUnexpected(reason, s.state) ? 1 : 0, s.state, s.lastSummaryLine ?? null, s.id);
}

export interface ArchivedRow {
  id: string;
  agent: string;
  title: string;
  cwd: string;
  host: string;
  lastState: string;
  lastSummary: string | null;
  startedAt: number;
  endedAt: number | null;
  endReason: string | null;
  unexpected: boolean;
  claudeSessionId?: string;
  parentId?: string;
  resumedInto?: string;
}

interface Raw {
  id: string;
  agent: string;
  title: string;
  cwd: string;
  host: string;
  last_state: string;
  last_summary: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  unexpected: number;
  claude_session_id: string | null;
  parent_id: string | null;
  resumed_into: string | null;
}

function toRow(r: Raw): ArchivedRow {
  return {
    id: r.id,
    agent: r.agent,
    title: r.title,
    cwd: r.cwd,
    host: r.host,
    lastState: r.last_state,
    lastSummary: r.last_summary,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endReason: r.end_reason,
    unexpected: r.unexpected === 1,
    claudeSessionId: r.claude_session_id ?? undefined,
    parentId: r.parent_id ?? undefined,
    resumedInto: r.resumed_into ?? undefined,
  };
}

// Actionable first (resumable Claude, then unexpected), clean exits last; recency within.
const ORDER_SQL = `
  ORDER BY
    (CASE WHEN agent='claude-code' AND claude_session_id IS NOT NULL THEN 0 ELSE 1 END),
    (CASE WHEN unexpected=1 THEN 0 ELSE 1 END),
    ended_at DESC`;

export function listArchived(db: Database): ArchivedRow[] {
  return (db.query(`SELECT * FROM sessions WHERE status='archived' ${ORDER_SQL}`).all() as Raw[]).map(toRow);
}

export function getArchived(db: Database, id: string): ArchivedRow | undefined {
  const r = db.query(`SELECT * FROM sessions WHERE id=? AND status='archived'`).get(id) as Raw | null;
  return r ? toRow(r) : undefined;
}

export function deleteArchived(db: Database, id: string): boolean {
  const r = db.query(`DELETE FROM sessions WHERE id=? AND status='archived'`).run(id);
  if (r.changes === 0) return false; // not archived — never touch a live session's events
  db.query(`DELETE FROM session_events WHERE session_id=?`).run(id);
  return true;
}

// On boot: mark local live rows whose id is not in the current tmux set as
// died-offline; upsert the ones still alive and any brand-new tmux sessions.
export function reconcileOnBoot(db: Database, liveSessions: Session[], at: number = Date.now()): void {
  const liveIds = new Set(liveSessions.map((s) => s.id));
  const staleRows = db.query(`SELECT * FROM sessions WHERE status='live' AND host='local'`).all() as Raw[];
  for (const r of staleRows) {
    if (liveIds.has(r.id)) continue;
    db.query(`UPDATE sessions SET status='archived', ended_at=?, end_reason='died-offline', unexpected=? WHERE id=?`).run(
      at,
      isUnexpected("died-offline", r.last_state) ? 1 : 0,
      r.id,
    );
  }
  for (const s of liveSessions) upsertLive(db, s);
}

export function markResumed(db: Database, archivedId: string, newLiveId: string): void {
  db.query(`UPDATE sessions SET resumed_into=? WHERE id=?`).run(newLiveId, archivedId);
  db.query(`UPDATE sessions SET parent_id=? WHERE id=?`).run(archivedId, newLiveId);
}

// Subscribe to the hub's event bus and mirror session truth into sqlite. Keeps
// a per-id last-state map so only real state transitions append an event.
export function createPersistenceListener(db: Database, events: EventEmitter): () => void {
  const lastState = new Map<string, string>();
  const onUpdate = (s: Session) => {
    upsertLive(db, s);
    if (lastState.get(s.id) !== s.state) {
      appendEvent(db, s.id, s.lastActivityAt, s.state, s.lastSummaryLine ?? null);
      lastState.set(s.id, s.state);
    }
  };
  const onRemove = (s: Session, reason?: EndReason) => {
    archive(db, s, reason ?? "reaped");
    lastState.delete(s.id);
  };
  events.on("update", onUpdate);
  events.on("remove", onRemove);
  return () => {
    events.off("update", onUpdate);
    events.off("remove", onRemove);
  };
}
