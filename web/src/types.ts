export type { Session, SessionState, AgentKind } from "../../src/types";
export { AGENT_KINDS } from "../../src/types";

export interface ArchivedSession {
  id: string;
  agent: string;
  title: string;
  cwd: string;
  host: string;
  lastState: string;
  lastSummary: string | null;
  startedAt: number;
  endedAt: number | null;
  endReason: string | null;
  unexpected: boolean;
  claudeSessionId?: string;
  parentId?: string;
  resumedInto?: string;
}
