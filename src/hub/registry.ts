import type { Session } from "../types";
import type { AdapterEvent } from "../adapters/types";
import { nextState } from "./state-machine";

export function titleFromPrompt(prompt: string): string {
  const line = prompt.replace(/\s+/g, " ").trim();
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

export class Registry {
  private map = new Map<string, Session>();

  upsert(s: Session): void {
    this.map.set(s.id, s);
  }

  get(id: string): Session | undefined {
    return this.map.get(id);
  }

  list(): Session[] {
    return [...this.map.values()];
  }

  rename(id: string, title: string): Session | undefined {
    const current = this.map.get(id);
    if (!current) return undefined;
    const updated = { ...current, title, titleLocked: true, lastActivityAt: Date.now() };
    this.map.set(id, updated);
    return updated;
  }

  remove(id: string): Session | undefined {
    const s = this.map.get(id);
    if (s) this.map.delete(id);
    return s;
  }

  setStale(id: string, since: number | undefined): Session | undefined {
    const current = this.map.get(id);
    if (!current) return undefined;
    const updated: Session = { ...current, staleSince: since };
    this.map.set(id, updated);
    return updated;
  }

  setClaudeSessionId(id: string, claudeSessionId: string): Session | undefined {
    const current = this.map.get(id);
    if (!current) return undefined;
    const updated: Session = { ...current, claudeSessionId };
    this.map.set(id, updated);
    return updated;
  }

  applyEvent(e: AdapterEvent): Session | undefined {
    const s = this.map.get(e.sessionId);
    if (!s) return undefined;
    const summary = "summary" in e && e.summary ? e.summary : s.lastSummaryLine;
    const promptTitle =
      e.type === "turn-start" && "summary" in e && e.summary && !s.titleLocked
        ? titleFromPrompt(e.summary)
        : undefined;
    const updated: Session = {
      ...s,
      state: nextState(s.state, e),
      lastActivityAt: e.at,
      lastSummaryLine: summary,
      staleSince: undefined,
      title: promptTitle ?? s.title,
      titleLocked: promptTitle ? true : s.titleLocked,
    };
    this.map.set(s.id, updated);
    return updated;
  }
}
