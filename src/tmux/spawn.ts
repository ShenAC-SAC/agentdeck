import { tmux } from "./tmux";
import { vettedConfig } from "./config";
import { claudeSettings, codexNotifyScript } from "../adapters/install";
import { startHeuristicPoller } from "../adapters/heuristic";
import type { AgentKind } from "../types";
import type { Registry } from "../hub/registry";
import { numberedTerminalTitle } from "../workspace";
import { remoteTmuxNewSession, sshTargetFromHost } from "../remote/ssh";
import { deckSessionOptions } from "../hub/rehydrate";

const tmpDir = () => process.env.TMPDIR ?? "/tmp";

export interface SpawnResult {
  id: string;
  target: string;
  stop: () => void; // stops the heuristic poller, if any
}

// Starts an agent in a deck-managed tmux session, wires its events to the hub,
// and registers it. Each session runs a small launcher script so agent flags
// (e.g. codex's quoted notify config) are written to a file, not nested shells.
export async function spawnAgent(opts: {
  agent: AgentKind;
  name: string;
  registry: Registry;
  hubPort: number;
  title?: string;
  cwd?: string;
}): Promise<SpawnResult> {
  const { agent, name, registry, hubPort } = opts;
  const cwd = opts.cwd ?? process.env.HOME ?? process.cwd();
  const base = `${tmpDir()}/deck-${name}`;
  await Bun.write(`${base}.tmux.conf`, vettedConfig());

  let launch: string;
  if (agent === "claude-code") {
    await Bun.write(`${base}.claude-settings.json`, JSON.stringify(claudeSettings(hubPort, name)));
    launch = `exec claude --settings "${base}.claude-settings.json"`;
  } else if (agent === "codex") {
    await Bun.write(`${base}.codex-notify.sh`, codexNotifyScript(hubPort, name));
    launch = `exec codex -c 'notify=["bash","${base}.codex-notify.sh"]'`;
  } else if (agent === "opencode") {
    launch = "exec opencode";
  } else {
    launch = `exec ${process.env.SHELL ?? "bash"}`;
  }
  await Bun.write(`${base}.launch.sh`, `#!/usr/bin/env bash\n${launch}\n`);

  const target = await tmux.newSession(name, `bash ${base}.launch.sh`, {
    configPath: `${base}.tmux.conf`,
    cwd,
  });
  const finalTitle = opts.title ?? numberedTerminalTitle(agent, "local", cwd, registry.list());
  for (const [key, value] of deckSessionOptions({ agent, cwd, host: "local", title: finalTitle })) {
    await tmux.setSessionOption(name, key, value).catch(() => {});
  }
  registry.upsert({
    id: name,
    agent,
    title: finalTitle,
    tmuxTarget: target,
    cwd,
    host: "local",
    state: "idle",
    lastActivityAt: Date.now(),
    lastSummaryLine: "",
  });

  // Agents without a precise event surface fall back to the capture-pane poller.
  const stop =
    agent === "opencode" || agent === "generic" ? startHeuristicPoller(target, name, hubPort) : () => {};

  return { id: name, target, stop };
}

export async function spawnRemoteShell(opts: {
  host: string;
  name: string;
  registry: Registry;
  cwd: string;
  title?: string;
}): Promise<SpawnResult> {
  const targetHost = sshTargetFromHost(opts.host);
  if (!targetHost) throw new Error("remote shell host must be ssh:<target>");
  const target = await remoteTmuxNewSession(targetHost, opts.name, opts.cwd);
  opts.registry.upsert({
    id: opts.name,
    agent: "generic",
    title: opts.title ?? numberedTerminalTitle("generic", opts.host, opts.cwd, opts.registry.list()),
    tmuxTarget: target,
    cwd: opts.cwd,
    host: opts.host,
    state: "idle",
    lastActivityAt: Date.now(),
    lastSummaryLine: "",
  });
  return { id: opts.name, target, stop: () => {} };
}
