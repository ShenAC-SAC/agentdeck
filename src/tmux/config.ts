// One vetted tmux config for deck's own server. Each line pre-empts a known
// terminal-feature-passthrough gap (design §13): true color, clipboard, mouse,
// enough scrollback for capture-pane, and extended keys for Shift+Enter.
// Verified: claude/opencode honor extended-keys inside tmux; codex does not (a
// known papercut) — it does not affect deck's monitoring or jump features.
export function vettedConfig(): string {
  return [
    'set -g default-terminal "tmux-256color"',
    'set -as terminal-features ",*:RGB"',
    "set -g set-clipboard on",
    "set -g mouse on",
    "set -g history-limit 50000",
    "set -g extended-keys on",
  ].join("\n");
}
