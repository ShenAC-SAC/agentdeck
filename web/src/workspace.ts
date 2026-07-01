import type { Session, SessionState } from "./types";

const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

export function workspaceName(cwd: string): string {
  if (!cwd || cwd === "~") return "home";
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

export interface WorkspaceGroup {
  cwd: string;
  name: string;
  sessions: Session[];
  waiting: number;
}

export function groupByWorkspace(sessions: Session[]): WorkspaceGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const arr = map.get(s.cwd) ?? [];
    arr.push(s);
    map.set(s.cwd, arr);
  }
  const groups: WorkspaceGroup[] = [...map.entries()].map(([cwd, list]) => ({
    cwd,
    name: workspaceName(cwd),
    sessions: [...list].sort(
      (a, b) => ORDER[a.state] - ORDER[b.state] || b.lastActivityAt - a.lastActivityAt,
    ),
    waiting: list.filter((s) => s.state === "waiting").length,
  }));
  return groups.sort((a, b) => {
    const aw = a.waiting > 0 ? 1 : 0;
    const bw = b.waiting > 0 ? 1 : 0;
    if (aw !== bw) return bw - aw;
    const at = Math.max(...a.sessions.map((s) => s.lastActivityAt), 0);
    const bt = Math.max(...b.sessions.map((s) => s.lastActivityAt), 0);
    return bt - at;
  });
}
