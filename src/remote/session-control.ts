import { shQuote } from "./ssh";

export function remoteKillSessionCommand(sessionId: string): string {
  return `tmux -L deck kill-session -t ${shQuote(sessionId)}`;
}

export function remoteSessionAbsent(error: string | undefined): boolean {
  return Boolean(error && /can't find session|no server running|error connecting to .*deck .*No such file or directory/i.test(error));
}

export function remoteRenameSessionCommand(sessionId: string, title: string): string {
  const target = shQuote(sessionId);
  return [
    `old_title="$(tmux -L deck show-options -t ${target} -v @deck_title 2>/dev/null || true)"`,
    `old_locked="$(tmux -L deck show-options -t ${target} -v @deck_title_locked 2>/dev/null || true)"`,
    `tmux -L deck set-option -t ${target} @deck_title ${shQuote(title)}`,
    "status=$?",
    `if [ "$status" -eq 0 ]; then tmux -L deck set-option -t ${target} @deck_title_locked '1'; status=$?; fi`,
    'if [ "$status" -ne 0 ]; then',
    `  tmux -L deck set-option -t ${target} @deck_title "$old_title" >/dev/null 2>&1 || true`,
    `  tmux -L deck set-option -t ${target} @deck_title_locked "$old_locked" >/dev/null 2>&1 || true`,
    '  exit "$status"',
    "fi",
  ].join("\n");
}
