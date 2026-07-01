export type SessionState = "working" | "waiting" | "idle" | "error";
export type AgentKind = "claude-code" | "codex" | "opencode" | "generic";
// 'local' for now; remote host names arrive in M2.
export type Host = "local" | (string & {});

export interface Session {
  id: string;
  agent: AgentKind;
  title: string;
  tmuxTarget: string; // "session:window.pane"
  host: Host;
  state: SessionState;
  lastActivityAt: number; // epoch millis
  lastSummaryLine: string;
}
