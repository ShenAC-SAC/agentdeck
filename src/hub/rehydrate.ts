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
