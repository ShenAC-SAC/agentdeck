import type { EventEmitter } from "node:events";
import { mapClaudeHook } from "../adapters/claude-code";
import { mapCodexNotify } from "../adapters/codex";
import type { Registry } from "../hub/registry";
import type { Session } from "../types";
import { isAgentKind } from "../types";

export const FIELDS =
  "#{session_name}|#{@deck_agent}|#{@deck_title}|#{@deck_cwd}|#{@deck_event_seq}|#{@deck_event_agent}|#{@deck_event_payload}";

export interface PollRow {
  name: string;
  agent: string;
  title: string;
  cwd: string;
  eventSeq: number;
  eventAgent?: string;
  payloadB64?: string;
}

export function parseListSessions(output: string): PollRow[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", agent = "", title = "", cwd = "", seq = "0", eventAgent = "", payloadB64 = ""] =
        line.split("|");
      return {
        name,
        agent,
        title,
        cwd,
        eventSeq: Number(seq) || 0,
        eventAgent: eventAgent || undefined,
        payloadB64: payloadB64 || undefined,
      };
    });
}

function ensureSession(registry: Registry, host: string, row: PollRow): void {
  if (registry.get(row.name)) return;
  const agent = isAgentKind(row.agent) ? row.agent : "generic";
  registry.upsert({
    id: row.name,
    agent,
    title: row.title || row.name,
    tmuxTarget: `${row.name}:0.0`,
    cwd: row.cwd || "/",
    host,
    state: "idle",
    lastActivityAt: Date.now(),
    lastSummaryLine: "",
  } as Session);
}

export function ingestRows(
  registry: Registry,
  events: EventEmitter,
  host: string,
  rows: PollRow[],
  seen: Map<string, number>,
): void {
  const present = new Set(rows.map((row) => row.name));

  for (const row of rows) {
    ensureSession(registry, host, row);
    const lastSeq = seen.get(row.name) ?? 0;
    if (row.eventSeq > lastSeq && row.eventAgent && row.payloadB64) {
      seen.set(row.name, row.eventSeq);
      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.from(row.payloadB64, "base64").toString("utf8"));
      } catch {
        continue;
      }
      const evt =
        row.eventAgent === "codex" ? mapCodexNotify(row.name, payload) : mapClaudeHook(row.name, payload);
      const updated = registry.applyEvent(evt);
      if (updated) events.emit("update", updated);
    } else if (row.eventSeq === 0) {
      const session = registry.get(row.name);
      if (session) events.emit("update", session);
    }
  }

  for (const session of registry.list()) {
    if (session.host !== host || present.has(session.id)) continue;
    const removed = registry.remove(session.id);
    seen.delete(session.id);
    if (removed) events.emit("remove", removed, "reaped");
  }
}
