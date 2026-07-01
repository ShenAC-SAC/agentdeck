import { tmux } from "./tmux";
import { vettedConfig } from "./config";
import type { AgentKind } from "../types";

const CMD: Record<AgentKind, string> = {
  "claude-code": "claude",
  codex: "codex",
  opencode: "opencode",
  generic: process.env.SHELL ?? "bash",
};

// Starts an agent in a deck-managed tmux session. The deck server inherits this
// process's (fresh) environment at start, so API keys / SSH_AUTH_SOCK are current
// for M1; per-session env overrides can be added later via tmux.newSession.
export async function spawnAgent(opts: { agent: AgentKind; name: string }): Promise<{ target: string }> {
  const cfgPath = `${process.env.TMPDIR ?? "/tmp"}/deck-${opts.name}.tmux.conf`;
  await Bun.write(cfgPath, vettedConfig());
  const target = await tmux.newSession(opts.name, CMD[opts.agent], { configPath: cfgPath });
  return { target };
}
