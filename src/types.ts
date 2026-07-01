export type SessionState = "working" | "waiting" | "idle" | "error";
export type AgentKind = "claude-code" | "codex" | "opencode" | "generic";
export const AGENT_KINDS = ["claude-code", "codex", "opencode", "generic"] as const;
// 'local' for now; remote host names arrive in M2.
export type Host = "local" | (string & {});

export function isAgentKind(value: unknown): value is AgentKind {
  return typeof value === "string" && (AGENT_KINDS as readonly string[]).includes(value);
}

export interface Session {
  id: string;
  agent: AgentKind;
  title: string;
  tmuxTarget: string; // "session:window.pane"
  cwd: string; // workspace directory the agent runs in
  host: Host;
  state: SessionState;
  lastActivityAt: number; // epoch millis
  lastSummaryLine: string;
}
