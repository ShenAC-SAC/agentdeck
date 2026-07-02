import { homedir } from "node:os";
import { join } from "node:path";

export interface SshHost {
  alias: string;
  hostname?: string;
  user?: string;
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
