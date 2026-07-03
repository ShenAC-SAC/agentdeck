import { tmux } from "./tmux";
import { vettedConfig } from "./config";
import { claudeSettings, codexNotifyScript } from "../adapters/install";
import { startHeuristicPoller } from "../adapters/heuristic";
import type { AgentKind } from "../types";
import type { Registry } from "../hub/registry";
import { numberedTerminalTitle } from "../workspace";
import { shQuote } from "../remote/ssh";
import { deckSessionOptions } from "../hub/rehydrate";
import { ensureMaster, runRemote } from "../remote/connection";
import { remoteClaudeSettings, remoteCodexNotifyArg, remoteReportScript } from "../remote/report";

const tmpDir = () => process.env.TMPDIR ?? "/tmp";

export interface SpawnResult {
  id: string;
  target: string;
  stop: () => void; // stops the heuristic poller, if any
}

export function claudeLaunchCommand(settingsPath: string, resumeSessionId?: string): string {
  const resume = resumeSessionId ? ` --resume ${shQuote(resumeSessionId)}` : "";
  return `exec claude${resume} --settings "${settingsPath}"`;
}

export function remoteAgentLaunch(
  agent: AgentKind,
  reportPath: string,
  settingsPath = `${reportPath}.settings.json`,
): string {
  if (agent === "claude-code") return `exec claude --settings ${shQuote(settingsPath)}`;
  if (agent === "codex") return `exec codex -c ${shQuote(remoteCodexNotifyArg(reportPath))}`;
  if (agent === "opencode") return "exec opencode";
  return "exec ${SHELL:-bash}";
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
  resumeSessionId?: string;
}): Promise<SpawnResult> {
  const { agent, name, registry, hubPort } = opts;
  const cwd = opts.cwd ?? process.env.HOME ?? process.cwd();
  const base = `${tmpDir()}/deck-${name}`;
  await Bun.write(`${base}.tmux.conf`, vettedConfig());

  let launch: string;
  if (agent === "claude-code") {
    const settingsPath = `${base}.claude-settings.json`;
    await Bun.write(settingsPath, JSON.stringify(claudeSettings(hubPort, name)));
    launch = claudeLaunchCommand(settingsPath, opts.resumeSessionId);
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

async function setRemoteMetaOrKill(
  host: string,
  name: string,
  meta: { agent: AgentKind; cwd: string; title: string },
): Promise<void> {
  for (const [key, value] of deckSessionOptions({ agent: meta.agent, cwd: meta.cwd, host, title: meta.title })) {
    const set = await runRemote(host, `tmux -L deck set-option -t ${shQuote(name)} ${key} ${shQuote(value)}`);
    if (!set.ok) {
      await runRemote(host, `tmux -L deck kill-session -t ${shQuote(name)}`);
      throw new Error(`remote metadata write failed (${key}): ${set.error}`);
    }
  }
}

export async function spawnRemoteAgent(opts: {
  host: string;
  agent: AgentKind;
  name: string;
  registry: Registry;
  cwd: string;
  title?: string;
}): Promise<SpawnResult> {
  const { host, agent, name, registry, cwd } = opts;
  await ensureMaster(host);
  if (!cwd.startsWith("/")) throw new Error("remote cwd must be an absolute directory");
  const check = await runRemote(host, `test -d ${shQuote(cwd)} && command -v tmux >/dev/null`);
  if (!check.ok) throw new Error(`remote workspace invalid: ${check.error ?? "test/tmux check failed"}`);

  const base = `/tmp/deck-${name}`;
  const reportPath = `${base}.report.sh`;
  const files: string[] = [];
  if (agent === "claude-code" || agent === "codex") {
    files.push(`cat > ${shQuote(reportPath)} <<'DECK_EOF'\n${remoteReportScript(name, agent)}DECK_EOF`);
    if (agent === "claude-code") {
      files.push(
        `cat > ${shQuote(`${reportPath}.settings.json`)} <<'DECK_EOF'\n${JSON.stringify(remoteClaudeSettings(reportPath))}\nDECK_EOF`,
      );
    }
  }
  files.push(
    `cat > ${shQuote(`${base}.launch.sh`)} <<'DECK_EOF'\n#!/usr/bin/env bash\n${remoteAgentLaunch(agent, reportPath)}\nDECK_EOF`,
  );
  const setup = await runRemote(host, files.join("\n"));
  if (!setup.ok) throw new Error(`remote setup failed: ${setup.error}`);

  const start = await runRemote(
    host,
    `tmux -L deck new-session -d -s ${shQuote(name)} -c ${shQuote(cwd)} ${shQuote(`bash ${base}.launch.sh`)}`,
  );
  if (!start.ok) throw new Error(`remote spawn failed: ${start.error}`);

  const title = opts.title ?? name;
  await setRemoteMetaOrKill(host, name, { agent, cwd, title });
  registry.upsert({
    id: name,
    agent,
    title,
    tmuxTarget: `${name}:0.0`,
    cwd,
    host,
    state: "idle",
    lastActivityAt: Date.now(),
    lastSummaryLine: "",
  });
  return { id: name, target: `${name}:0.0`, stop: () => {} };
}

export async function spawnRemoteShell(opts: {
  host: string;
  name: string;
  registry: Registry;
  cwd: string;
  title?: string;
}): Promise<SpawnResult> {
  const { host, name, registry, cwd } = opts;
  await ensureMaster(host);
  if (!cwd.startsWith("/")) throw new Error("remote cwd must be an absolute directory");
  const start = await runRemote(
    host,
    `tmux -L deck new-session -d -s ${shQuote(name)} -c ${shQuote(cwd)} ${shQuote("exec ${SHELL:-bash}")}`,
  );
  if (!start.ok) throw new Error(`remote spawn failed: ${start.error}`);
  const title = opts.title ?? numberedTerminalTitle("generic", host, cwd, registry.list());
  await setRemoteMetaOrKill(host, name, { agent: "generic", cwd, title });
  opts.registry.upsert({
    id: name,
    agent: "generic",
    title,
    tmuxTarget: `${name}:0.0`,
    cwd,
    host,
    state: "idle",
    lastActivityAt: Date.now(),
    lastSummaryLine: "",
  });
  return { id: name, target: `${name}:0.0`, stop: () => {} };
}
