import { parseListPanes, type PaneInfo } from "./parse";

// deck runs its own tmux server on a private socket so it never touches the
// user's normal tmux sessions or their config.
const SOCKET = "deck";

async function run(args: string[]): Promise<string> {
  const proc = Bun.spawn(["tmux", "-L", SOCKET, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(err.trim() || `tmux ${args.join(" ")} exited ${code}`);
  }
  return out;
}

interface ClientInfo {
  name: string;
  activity: number;
}

function parseListClients(raw: string): ClientInfo[] {
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [name = "", activity = "0"] = line.split("|");
      return { name, activity: Number(activity) || 0 };
    });
}

function mostRecentClient(clients: ClientInfo[]): ClientInfo | undefined {
  return [...clients].sort((a, b) => b.activity - a.activity)[0];
}

export const tmux = {
  run,
  async listPanes(): Promise<PaneInfo[]> {
    const fmt = "#{session_name}:#{window_index}.#{pane_index}|#{pane_title}|#{pane_current_command}";
    return parseListPanes(await run(["list-panes", "-a", "-F", fmt]));
  },
  capturePane(target: string): Promise<string> {
    return run(["capture-pane", "-p", "-t", target]);
  },
  async listClients(): Promise<ClientInfo[]> {
    return parseListClients(await run(["list-clients", "-F", "#{client_name}|#{client_activity}"]));
  },
  async switchClient(target: string, opts: { client?: string } = {}): Promise<string> {
    const client = opts.client ?? mostRecentClient(await this.listClients())?.name;
    if (!client) {
      throw new Error("no attached deck tmux client; run 'tmux -L deck attach' in another terminal first");
    }
    return run(["switch-client", "-c", client, "-t", target]);
  },
  // `-f` loads the config as the server starts; on an already-running server it
  // is ignored. Passing it on every new-session is therefore safe and boots the
  // very first deck session with the vetted config. (Using source-file instead
  // fails when no server is running yet.)
  async newSession(
    name: string,
    cmd: string,
    opts: { configPath?: string; env?: Record<string, string> } = {},
  ): Promise<string> {
    const pre = opts.configPath ? ["-f", opts.configPath] : [];
    const envArgs = Object.entries(opts.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    await run([...pre, "new-session", "-d", "-s", name, ...envArgs, cmd]);
    return `${name}:0.0`;
  },
};
