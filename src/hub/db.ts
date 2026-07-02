import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  agent             TEXT NOT NULL,
  title             TEXT NOT NULL,
  cwd               TEXT NOT NULL,
  host              TEXT NOT NULL DEFAULT 'local',
  status            TEXT NOT NULL,
  last_state        TEXT NOT NULL,
  last_summary      TEXT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  end_reason        TEXT,
  unexpected        INTEGER NOT NULL DEFAULT 0,
  claude_session_id TEXT,
  parent_id         TEXT,
  resumed_into      TEXT
);

CREATE TABLE IF NOT EXISTS session_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  at         INTEGER NOT NULL,
  state      TEXT NOT NULL,
  summary    TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_session_at ON session_events(session_id, at);
`;

// Idempotent DDL + a user_version stamp that future migrations can gate on.
export function applySchema(db: Database): void {
  db.run(SCHEMA);
  db.run("PRAGMA user_version = 1");
}

export function defaultDbPath(): string {
  return process.env.DECK_DB ?? join(homedir(), ".agentdeck", "deck.db");
}

export function openDb(dbPath: string = defaultDbPath()): Database {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  applySchema(db);
  return db;
}
