import type { AgentKind } from "../types";

// Where an agent's hook/notify should POST. deck's own sessionId + agent ride in
// the query string; the agent's native payload goes in the body.
export function hubEventsUrl(port: number, sessionId: string, agent: AgentKind): string {
  return `http://localhost:${port}/events?sessionId=${encodeURIComponent(sessionId)}&agent=${agent}`;
}

// Claude Code settings whose Stop/Notification hooks pipe the native hook JSON
// (stdin) to the hub. Launched via `claude --settings <file>`.
export function claudeSettings(port: number, sessionId: string): { hooks: Record<string, unknown> } {
  const command = `curl -s -X POST "${hubEventsUrl(port, sessionId, "claude-code")}" --data-binary @-`;
  const entry = [{ hooks: [{ type: "command", command }] }];
  return { hooks: { Stop: entry, Notification: entry } };
}

// Codex notify script that posts the notify JSON ($1) to the hub. Referenced via
// `codex -c 'notify=["bash","<path>"]'`.
export function codexNotifyScript(port: number, sessionId: string): string {
  const url = hubEventsUrl(port, sessionId, "codex");
  return `#!/usr/bin/env bash\ncurl -s -X POST "${url}" --data-binary "$1" >/dev/null\n`;
}
