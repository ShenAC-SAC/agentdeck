import type { AgentKind } from "../types";

export interface AgentAvailability {
  agent: AgentKind;
  label: string;
  available: boolean;
  command: string;
}

export type CommandRunner = (command: string) => Promise<string>;

const AGENTS: Array<{ agent: AgentKind; label: string; command: string; always?: boolean }> = [
  { agent: "claude-code", label: "Claude Code", command: "claude" },
  { agent: "codex", label: "Codex", command: "codex" },
  { agent: "opencode", label: "opencode", command: "opencode" },
  { agent: "generic", label: "Shell", command: process.env.SHELL ?? "bash", always: true },
];

async function commandV(command: string): Promise<string> {
  const proc = Bun.spawn(["/usr/bin/env", "bash", "-lc", `command -v ${command}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
}

export async function detectLocalAgents(run: CommandRunner = commandV): Promise<AgentAvailability[]> {
  const result: AgentAvailability[] = [];
  for (const a of AGENTS) {
    const found = a.always ? a.command : await run(a.command);
    result.push({
      agent: a.agent,
      label: a.label,
      available: a.always ? true : found.length > 0,
      command: a.command,
    });
  }
  return result;
}
