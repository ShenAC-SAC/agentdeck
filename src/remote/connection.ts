import { tmpdir } from "node:os";
import { join } from "node:path";

export function controlPath(alias: string): string {
  const safe = alias.replace(/[^A-Za-z0-9_.-]/g, "_");
  return join(tmpdir(), `deck-ssh-${safe}.sock`);
}

export function masterArgs(alias: string): string[] {
  return ["-M", "-N", "-o", `ControlPath=${controlPath(alias)}`, "-o", "ControlPersist=300", alias];
}

export function sshArgs(alias: string, remoteCommand: string): string[] {
  return ["-o", `ControlPath=${controlPath(alias)}`, alias, remoteCommand];
}

const masters = new Map<string, ReturnType<typeof Bun.spawn>>();

export async function ensureMaster(alias: string): Promise<void> {
  if (masters.has(alias)) return;
  const proc = Bun.spawn(["ssh", ...masterArgs(alias)], { stdout: "ignore", stderr: "ignore" });
  masters.set(alias, proc);
}

export async function closeMaster(alias: string): Promise<void> {
  const proc = masters.get(alias);
  if (proc) {
    try {
      proc.kill();
    } catch {
      // The ssh master may have exited by itself; closing should stay idempotent.
    }
    masters.delete(alias);
  }
  await Bun.spawn(["ssh", "-O", "exit", "-o", `ControlPath=${controlPath(alias)}`, alias], {
    stdout: "ignore",
    stderr: "ignore",
  }).exited;
}

export async function runRemote(
  alias: string,
  remoteCommand: string,
): Promise<{ ok: boolean; stdout: string; error?: string }> {
  const proc = Bun.spawn(["ssh", ...sshArgs(alias, remoteCommand)], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return code === 0 ? { ok: true, stdout } : { ok: false, stdout, error: stderr.trim() || `ssh exited ${code}` };
}
