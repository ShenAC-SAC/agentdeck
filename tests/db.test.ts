import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { applySchema } from "../src/hub/db";

test("applySchema creates sessions + session_events and is idempotent", () => {
  const db = new Database(":memory:");
  applySchema(db);
  applySchema(db);
  const tables = db
    .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r: any) => r.name);
  expect(tables).toContain("sessions");
  expect(tables).toContain("session_events");
  const version = (db.query("PRAGMA user_version").get() as any).user_version;
  expect(version).toBe(1);
});
