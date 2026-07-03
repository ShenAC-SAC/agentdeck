export function shQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export function remoteAttachCommand(target: string, tmuxTarget: string): string[] {
  const session = String(tmuxTarget).split(":")[0];
  return ["ssh", "-tt", target, `tmux -L deck attach -t ${shQuote(session)}`];
}
