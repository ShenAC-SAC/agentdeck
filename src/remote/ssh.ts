export function sshTargetFromHost(host: string): string | undefined {
  if (!host.startsWith("ssh:")) return undefined;
  const target = host.slice("ssh:".length).trim();
  return target.length > 0 ? target : undefined;
}

export function shQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export function remoteNewSessionCommand(name: string, cwd: string): string {
  return `tmux -L deck new-session -d -s ${shQuote(name)} -c ${shQuote(cwd)} ${shQuote("exec ${SHELL:-bash}")}`;
}

export function remoteAttachCommand(target: string, tmuxTarget: string): string[] {
  const session = String(tmuxTarget).split(":")[0];
  return ["ssh", "-tt", target, `tmux -L deck attach -t ${shQuote(session)}`];
}

async function runSsh(target: string, command: string): Promise<string> {
  const proc = Bun.spawn(["ssh", target, command], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(err.trim() || `ssh ${target} exited ${code}`);
  return out;
}

export async function validateRemoteWorkspace(target: string, cwd: string): Promise<string | undefined> {
  if (!cwd.startsWith("/")) return "remote cwd must be an absolute directory";
  try {
    await runSsh(target, `test -d ${shQuote(cwd)} && command -v tmux >/dev/null`);
  } catch (e) {
    return e instanceof Error ? e.message : "remote workspace validation failed";
  }
}

export async function remoteTmuxNewSession(target: string, name: string, cwd: string): Promise<string> {
  await runSsh(target, remoteNewSessionCommand(name, cwd));
  return `${name}:0.0`;
}
