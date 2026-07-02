import type { EventEmitter } from "node:events";
import { mapClaudeHook } from "../adapters/claude-code";
import { mapCodexNotify } from "../adapters/codex";
import type { Registry } from "../hub/registry";
import type { AgentKind, Session } from "../types";
import { isAgentKind } from "../types";

export const FIELDS =
  "#{session_name}|#{@deck_agent}|#{@deck_title}|#{@deck_cwd}|#{@deck_event_seq}|#{@deck_event_agent}|#{@deck_event_payload}|#{@deck_event_queue}";

export interface PollRow {
  name: string;
  agent: string;
  title: string;
  cwd: string;
  eventSeq: number;
  eventAgent?: string;
  payloadB64?: string;
  eventQueue?: string;
}

export function parseListSessions(output: string): PollRow[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", agent = "", title = "", cwd = "", seq = "0", eventAgent = "", payloadB64 = "", eventQueue = ""] =
        line.split("|");
      return {
        name,
        agent,
        title,
        cwd,
        eventSeq: Number(seq) || 0,
        eventAgent: eventAgent || undefined,
        payloadB64: payloadB64 || undefined,
        eventQueue: eventQueue || undefined,
      };
    });
}

type DeckPollRow = PollRow & { agent: AgentKind };

function isDeckRow(row: PollRow): row is DeckPollRow {
  return Boolean(row.name && isAgentKind(row.agent));
}

interface RemoteEventEntry {
  seq: number;
  agent?: string;
  payloadB64?: string;
}

function eventEntries(row: PollRow): RemoteEventEntry[] {
  if (row.eventQueue) {
    return row.eventQueue
      .split(";")
      .map((entry) => {
        const [seq = "0", agent = "", payloadB64 = ""] = entry.split(",");
        return { seq: Number(seq) || 0, agent: agent || undefined, payloadB64: payloadB64 || undefined };
      })
      .filter((entry) => entry.seq > 0)
      .sort((a, b) => a.seq - b.seq);
  }
  if (row.eventSeq > 0 && row.eventAgent && row.payloadB64) {
    return [{ seq: row.eventSeq, agent: row.eventAgent, payloadB64: row.payloadB64 }];
  }
  return [];
}

function mapRemoteEvent(sessionId: string, agent: string | undefined, payload: unknown) {
  if (agent === "codex") return mapCodexNotify(sessionId, payload);
  if (agent === "claude-code") return mapClaudeHook(sessionId, payload);
}

function ensureSession(registry: Registry, host: string, row: DeckPollRow): void {
  if (registry.get(row.name)) return;
  registry.upsert({
    id: row.name,
    agent: row.agent,
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
  const deckRows = rows.filter(isDeckRow);
  const present = new Set(deckRows.map((row) => row.name));

  for (const row of deckRows) {
    ensureSession(registry, host, row);
    const lastSeq = seen.get(row.name) ?? 0;
    const nextEvents = eventEntries(row).filter((entry) => entry.seq > lastSeq);
    if (nextEvents.length > 0) {
      let latestSeq = lastSeq;
      for (const entry of nextEvents) {
        latestSeq = Math.max(latestSeq, entry.seq);
        if (!entry.payloadB64) continue;
        const evtAgent = entry.agent;
        if (evtAgent !== "codex" && evtAgent !== "claude-code") continue;
        let payload: unknown;
        try {
          payload = JSON.parse(Buffer.from(entry.payloadB64, "base64").toString("utf8"));
        } catch {
          continue;
        }
        const evt = mapRemoteEvent(row.name, evtAgent, payload);
        if (!evt) continue;
        const updated = registry.applyEvent(evt);
        if (updated) events.emit("update", updated);
      }
      seen.set(row.name, latestSeq);
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
