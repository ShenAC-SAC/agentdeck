import type { AdapterEvent } from "./types";

// Payload shapes confirmed via spike (claude -p, Stop hook fired):
//   Stop:             { hook_event_name: "Stop", last_assistant_message, session_id, cwd, ... }
//   Notification:     { hook_event_name: "Notification", message, ... }  (fires interactively)
//   UserPromptSubmit: { hook_event_name: "UserPromptSubmit", prompt, ... }  (turn begins)
export function mapClaudeHook(sessionId: string, body: unknown): AdapterEvent {
  const at = Date.now();
  const b = body as Record<string, unknown>;
  if (b?.hook_event_name === "Notification") {
    const message = asString(b.message);
    // Claude fires Notification for two very different things: a real block
    // that needs a decision ("Claude needs your permission to use Bash"), and a
    // generic turn-finished nudge ("Claude is waiting for your input"). The
    // adapter only classifies the explicit block; state-machine context decides
    // whether a generic turn end is a handoff or just a fresh idle session.
    if (isBlockingNotification(message)) {
      return { type: "needs-input", sessionId, at, summary: message };
    }
    return { type: "turn-end", sessionId, at };
  }
  if (b?.hook_event_name === "UserPromptSubmit") {
    return { type: "turn-start", sessionId, at, summary: asString(b.prompt) };
  }
  return { type: "turn-end", sessionId, at, summary: asString(b?.last_assistant_message) };
}

// A Notification is a genuine block only when it asks for a decision. Claude's
// permission/approval prompts carry these words; generic completion nudges do
// not, so they flow through the normal turn-end path.
function isBlockingNotification(message: string | undefined): boolean {
  if (!message) return false;
  return /permission|approv|confirm|authoriz|grant/i.test(message);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
