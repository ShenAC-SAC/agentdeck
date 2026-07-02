export function isTerminalSubmit(data: string): boolean {
  return data.includes("\r") || data.includes("\n");
}
