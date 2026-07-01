import type { AdapterEvent } from "./types";

// Payload shapes confirmed via spike (claude -p, Stop hook fired):
//   Stop:             { hook_event_name: "Stop", last_assistant_message, session_id, cwd, ... }
//   Notification:     { hook_event_name: "Notification", message, ... }  (fires interactively)
//   UserPromptSubmit: { hook_event_name: "UserPromptSubmit", prompt, ... }  (turn begins)
export function mapClaudeHook(sessionId: string, body: unknown): AdapterEvent {
  const at = Date.now();
  const b = body as Record<string, unknown>;
  if (b?.hook_event_name === "Notification") {
    return { type: "needs-input", sessionId, at, summary: asString(b.message) };
  }
  if (b?.hook_event_name === "UserPromptSubmit") {
    return { type: "turn-start", sessionId, at, summary: asString(b.prompt) };
  }
  return { type: "turn-end", sessionId, at, summary: asString(b?.last_assistant_message) };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
