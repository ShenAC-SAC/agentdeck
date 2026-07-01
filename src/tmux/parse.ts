export interface PaneInfo {
  target: string;
  title: string;
  command: string;
}

// Parses `tmux list-panes` output formatted as
// "#{session_name}:#{window_index}.#{pane_index}|#{pane_title}|#{pane_current_command}".
export function parseListPanes(raw: string): PaneInfo[] {
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [target = "", title = "", command = ""] = line.split("|");
      return { target, title, command };
    });
}
