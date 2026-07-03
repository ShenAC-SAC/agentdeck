import { homedir } from "node:os";
import { join } from "node:path";

export interface SshHost {
  alias: string;
  hostname?: string;
  user?: string;
}

export function validateRemoteHostAlias(host: string): string | undefined {
  if (!host.trim()) return "remote host must be a non-empty bare ssh alias";
  if (host === "local") return "remote host must not be local";
  if (host.startsWith("ssh:")) return "remote host must be a bare ssh alias, not ssh:<target>";
  if (host.startsWith("-")) return "remote host must not start with '-'";
  if (/\s|[\u0000-\u001f\u007f]/.test(host)) return "remote host must not contain whitespace or control characters";
  if (host.includes("/") || host.includes("\\")) return "remote host must not contain a path separator";
}

export function parseSshConfig(text: string): SshHost[] {
  const hosts: SshHost[] = [];
  let current: SshHost[] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const [keyRaw, ...rest] = line.split(/\s+/);
    const key = keyRaw.toLowerCase();
    const value = rest.join(" ");

    if (key === "host") {
      current = rest
        .filter((alias) => !alias.includes("*") && !alias.includes("?"))
        .map((alias) => {
          const host: SshHost = { alias };
          hosts.push(host);
          return host;
        });
    } else if (key === "hostname") {
      for (const host of current) host.hostname = value;
    } else if (key === "user") {
      for (const host of current) host.user = value;
    }
  }

  return hosts;
}

export async function readSshHosts(path: string = join(homedir(), ".ssh", "config")): Promise<SshHost[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  return parseSshConfig(await file.text());
}
