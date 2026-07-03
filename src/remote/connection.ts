import { unlinkSync } from "node:fs";
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
  return ["-o", "ControlMaster=auto", "-o", `ControlPath=${controlPath(alias)}`, alias, remoteCommand];
}

const masters = new Map<string, ReturnType<typeof Bun.spawn>>();
const DEFAULT_TIMEOUT_MS = 15_000;

function checkMasterArgs(alias: string): string[] {
  return ["-O", "check", "-o", `ControlPath=${controlPath(alias)}`, alias];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeControlPath(alias: string): void {
  try {
    unlinkSync(controlPath(alias));
  } catch {
    // Missing or already in use by another process.
  }
}

async function runSsh(args: string[], timeoutMs: number): Promise<{ ok: boolean; stdout: string; error?: string }> {
  const proc = Bun.spawn(["ssh", ...args], { stdout: "pipe", stderr: "pipe", env: process.env });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {
      // Process may already have exited.
    }
  }, timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).finally(() => clearTimeout(timer));
  if (timedOut) return { ok: false, stdout, error: `ssh timed out after ${timeoutMs}ms` };
  return code === 0 ? { ok: true, stdout } : { ok: false, stdout, error: stderr.trim() || `ssh exited ${code}` };
}

export async function ensureMaster(alias: string): Promise<void> {
  const initialCheck = await runSsh(checkMasterArgs(alias), 1_000);
  if (initialCheck.ok) return;

  const existing = masters.get(alias);
  if (existing) {
    try {
      existing.kill();
    } catch {
      // The cached master is already dead or unusable; replace it below.
    }
    masters.delete(alias);
  }
  removeControlPath(alias);

  const proc = Bun.spawn(["ssh", ...masterArgs(alias)], { stdout: "ignore", stderr: "ignore", env: process.env });
  masters.set(alias, proc);
  void proc.exited.then(() => {
    if (masters.get(alias) === proc) masters.delete(alias);
  });

  const deadline = Date.now() + 5_000;
  let lastError = initialCheck.error ?? "";
  while (Date.now() < deadline) {
    const check = await runSsh(checkMasterArgs(alias), 1_000);
    if (check.ok) return;
    lastError = check.error ?? "ssh master check failed";
    await sleep(100);
  }

  masters.delete(alias);
  try {
    proc.kill();
  } catch {
    // Already exited.
  }
  throw new Error(lastError || `ssh master for ${alias} did not become ready`);
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
  await runSsh(["-O", "exit", "-o", `ControlPath=${controlPath(alias)}`, alias], 5_000);
}

export async function runRemote(
  alias: string,
  remoteCommand: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ ok: boolean; stdout: string; error?: string }> {
  return runSsh(sshArgs(alias, remoteCommand), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}
