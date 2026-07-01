import type { Registry } from "./registry";
import { isAgentKind, type Session } from "../types";
import { tmux } from "../tmux/tmux";

export function deckSessionOptions(meta: {
  agent: string;
  cwd: string;
  host: string;
  title: string;
  titleLocked?: boolean;
}): Array<[string, string]> {
  return [
    ["@deck_agent", meta.agent],
    ["@deck_cwd", meta.cwd],
    ["@deck_host", meta.host],
    ["@deck_title", meta.title],
    ["@deck_title_locked", meta.titleLocked ? "1" : "0"],
  ];
}

const FIELDS =
  "#{session_name}|#{@deck_agent}|#{@deck_cwd}|#{@deck_host}|#{@deck_title}|#{@deck_title_locked}";

// Reconstruct a Session from one `list-sessions -F FIELDS` line, or null if the
// session was not spawned by deck (no @deck_agent) or its agent kind is unknown.
export function parseDeckSession(line: string, now: number): Session | null {
  const [name = "", agent = "", cwd = "", host = "", title = "", locked = ""] = line.split("|");
  if (!name || !agent || !isAgentKind(agent)) return null;
  return {
    id: name,
    agent,
    title: title || name,
    tmuxTarget: `${name}:0.0`,
    cwd: cwd || "/",
    host: host || "local",
    state: "idle",
    lastActivityAt: now,
    lastSummaryLine: "",
    titleLocked: locked === "1",
  };
}

export async function discoverDeckSessions(now = Date.now()): Promise<Session[]> {
  let out: string;
  try {
    out = await tmux.run(["list-sessions", "-F", FIELDS]);
  } catch {
    return []; // no server running / no sessions
  }
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseDeckSession(l, now))
    .filter((s): s is Session => s !== null);
}

// Adopt deck-spawned tmux sessions still alive on the socket, so restarting the
// app does not orphan running agents. Local only — remote lives on another host.
export async function rehydrate(registry: Registry): Promise<Session[]> {
  const found = await discoverDeckSessions();
  for (const s of found) registry.upsert(s);
  return found;
}
