import type { Database } from "bun:sqlite";
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
