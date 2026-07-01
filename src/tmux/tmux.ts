import { parseListPanes, type PaneInfo } from "./parse";

// deck runs its own tmux server on a private socket so it never touches the
// user's normal tmux sessions or their config.
const SOCKET = "deck";

async function run(args: string[]): Promise<string> {
  const proc = Bun.spawn(["tmux", "-L", SOCKET, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
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
  switchClient(target: string): Promise<string> {
    return run(["switch-client", "-t", target]);
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
