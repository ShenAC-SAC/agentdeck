import type { AgentKind } from "./types";

const AGENT_LABEL: Record<AgentKind, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "opencode",
  generic: "Shell",
};

export function workspaceName(cwd: string): string {
  if (!cwd || cwd === "~") return "home";
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

export function workspaceKey(host: string, cwd: string): string {
  return `${host}\u0000${cwd}`;
}

export function hostLabel(host: string): string {
  if (host === "local") return "Local";
  if (host.startsWith("ssh:")) return host.slice("ssh:".length);
  return host;
}

export function defaultTerminalTitle(agent: AgentKind, _host: string, cwd: string): string {
  return `${AGENT_LABEL[agent]} · ${workspaceName(cwd)}`;
}
