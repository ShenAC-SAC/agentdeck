import { shQuote } from "./ssh";

export function remoteReportScript(session: string, agent: "claude-code" | "codex"): string {
  const target = shQuote(session);
  return [
    "#!/usr/bin/env bash",
    'payload="$(cat)"',
    '[ -z "$payload" ] && payload="${1:-}"',
    'b64="$(printf \'%s\' "$payload" | base64 | tr -d \'\\n\')"',
    `seq="$(tmux -L deck show-options -t ${target} -v @deck_event_seq 2>/dev/null || echo 0)"`,
    'seq="$((seq+1))"',
    `tmux -L deck set-option -t ${target} @deck_event_seq "$seq"`,
    `tmux -L deck set-option -t ${target} @deck_event_agent ${shQuote(agent)}`,
    `tmux -L deck set-option -t ${target} @deck_event_payload "$b64"`,
    "",
  ].join("\n");
}

export function remoteClaudeSettings(reportPath: string): { hooks: Record<string, unknown> } {
  const entry = [{ hooks: [{ type: "command", command: `bash ${reportPath}` }] }];
  return { hooks: { UserPromptSubmit: entry, Stop: entry, Notification: entry } };
}

export function remoteCodexNotifyArg(reportPath: string): string {
  return `notify=["bash","${reportPath}"]`;
}
