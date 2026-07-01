import type { AdapterEvent } from "./types";

// Payload shape confirmed via spike (codex exec, notify fired):
//   { type: "agent-turn-complete", "last-assistant-message", cwd, "thread-id", ... }
// The approval event type was not reproducible headless; match defensively on
// "approval" until an interactive run confirms the exact name.
export function mapCodexNotify(sessionId: string, body: unknown): AdapterEvent {
  const at = Date.now();
  const b = body as Record<string, unknown>;
  const type = typeof b?.type === "string" ? b.type : "";
  if (type.includes("approval")) {
    return { type: "needs-input", sessionId, at };
  }
  return { type: "turn-end", sessionId, at, summary: asString(b?.["last-assistant-message"]) };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
