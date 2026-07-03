import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { validateRemoteHostAlias } from "./hosts";

export function connectedHostsPath(): string {
  return join(homedir(), ".agentdeck", "connected-hosts.json");
}

export async function readConnectedHosts(path: string = connectedHostsPath()): Promise<string[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    if (!Array.isArray(parsed)) return [];
    const clean = parsed
      .filter((host): host is string => typeof host === "string" && host.trim().length > 0)
      .map((host) => host.trim())
      .filter((host) => validateRemoteHostAlias(host) === undefined);
    return [...new Set(clean)].sort();
  } catch {
    return [];
  }
}

async function writeConnectedHosts(path: string, hosts: string[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const clean = [
    ...new Set(hosts.map((host) => host.trim()).filter((host) => validateRemoteHostAlias(host) === undefined)),
  ].sort();
  await Bun.write(path, `${JSON.stringify(clean, null, 2)}\n`);
}

export async function addConnectedHost(path: string, host: string): Promise<void> {
  await writeConnectedHosts(path, [...(await readConnectedHosts(path)), host]);
}

export async function removeConnectedHost(path: string, host: string): Promise<void> {
  await writeConnectedHosts(
    path,
    (await readConnectedHosts(path)).filter((current) => current !== host.trim()),
  );
}
