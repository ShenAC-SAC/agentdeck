import type { AgentAvailability } from "./api";

export function visibleAgentChoices(availableAgents: AgentAvailability[], hasRemoteHosts: boolean): AgentAvailability[] {
  return hasRemoteHosts ? availableAgents : availableAgents.filter((agent) => agent.available);
}
