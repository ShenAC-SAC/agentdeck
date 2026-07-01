import type { Session, SessionState } from "./types";
import { hostLabel, workspaceKey, workspaceName } from "../../src/workspace";

const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

export { hostLabel, workspaceKey, workspaceName };

export interface WorkspaceGroup {
  key: string;
  host: string;
  hostName: string;
  cwd: string;
  name: string;
  sessions: Session[];
  waiting: number;
}

export function groupByWorkspace(sessions: Session[]): WorkspaceGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = workspaceKey(s.host, s.cwd);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  const groups: WorkspaceGroup[] = [...map.entries()].map(([key, list]) => {
    const first = list[0];
    const host = first?.host ?? "local";
    const cwd = first?.cwd ?? "";
    return {
      key,
      host,
      hostName: hostLabel(host),
      cwd,
      name: workspaceName(cwd),
      sessions: [...list].sort(
        (a, b) => ORDER[a.state] - ORDER[b.state] || b.lastActivityAt - a.lastActivityAt,
      ),
      waiting: list.filter((s) => s.state === "waiting").length,
    };
  });
  return groups.sort((a, b) => {
    const aw = a.waiting > 0 ? 1 : 0;
    const bw = b.waiting > 0 ? 1 : 0;
    if (aw !== bw) return bw - aw;
    const ah = a.hostName.localeCompare(b.hostName);
    if (ah !== 0) return ah;
    const at = Math.max(...a.sessions.map((s) => s.lastActivityAt), 0);
    const bt = Math.max(...b.sessions.map((s) => s.lastActivityAt), 0);
    return bt - at;
  });
}
