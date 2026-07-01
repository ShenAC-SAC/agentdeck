import type { Session } from "./types";

export type AttentionKind = "waiting" | "error" | "stalled";

const RANK: Record<AttentionKind, number> = { waiting: 0, error: 1, stalled: 2 };

export function attentionKind(s: Session): AttentionKind | null {
  if (s.state === "waiting") return "waiting";
  if (s.state === "error") return "error";
  if (s.state === "working" && s.staleSince != null) return "stalled";
  return null;
}

export interface AttentionItem {
  session: Session;
  kind: AttentionKind;
}

// What needs the user right now, most urgent first. Within a kind the session
// that has waited longest (smallest lastActivityAt) comes first.
export function attentionItems(sessions: Session[]): AttentionItem[] {
  return sessions
    .map((session) => {
      const kind = attentionKind(session);
      return kind ? { session, kind } : null;
    })
    .filter((x): x is AttentionItem => x !== null)
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.session.lastActivityAt - b.session.lastActivityAt);
}
