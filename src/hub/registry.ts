import type { Session } from "../types";
import type { AdapterEvent } from "../adapters/types";
import { nextState } from "./state-machine";

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

  applyEvent(e: AdapterEvent): Session | undefined {
    const s = this.map.get(e.sessionId);
    if (!s) return undefined;
    const summary = "summary" in e && e.summary ? e.summary : s.lastSummaryLine;
    const updated: Session = {
      ...s,
      state: nextState(s.state, e),
      lastActivityAt: e.at,
      lastSummaryLine: summary,
    };
    this.map.set(s.id, updated);
    return updated;
  }
}
