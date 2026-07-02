import type { AgentKind } from "../types";
import { AGENT_MARK } from "./agent-mark-data";

export function AgentMark({ agent, size = 14 }: { agent: AgentKind; size?: number }) {
  const spec = AGENT_MARK[agent];
  return (
    <svg className="agent-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={spec.title}>
      <title>{spec.title}</title>
      {spec.mode === "fill" ? (
        <path d={spec.path} fill="currentColor" />
      ) : (
        <path
          d={spec.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
