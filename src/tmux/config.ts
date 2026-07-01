// One vetted tmux config for deck's own server. Each line pre-empts a known
// terminal-feature-passthrough gap (design §13): true color, clipboard, mouse,
// enough scrollback for capture-pane, and tmux support for extended keys.
// The renderer must still emit modified key sequences itself; see
// web/src/terminal-input.ts for Shift+Enter handling.
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
