import { test, expect } from "bun:test";
import { mapClaudeHook } from "../src/adapters/claude-code";
import { mapCodexNotify } from "../src/adapters/codex";

test("CC Stop -> turn-end, summary from last_assistant_message", () => {
  const e = mapClaudeHook("s", { hook_event_name: "Stop", last_assistant_message: "ok" });
  expect(e.type).toBe("turn-end");
  expect(e.type === "turn-end" && e.summary).toBe("ok");
});

test("CC Notification -> needs-input, summary from message", () => {
  const e = mapClaudeHook("s", { hook_event_name: "Notification", message: "needs approval" });
  expect(e.type).toBe("needs-input");
  expect(e.type === "needs-input" && e.summary).toBe("needs approval");
});

test("CC permission Notification -> needs-input (a real block)", () => {
  const e = mapClaudeHook("s", {
    hook_event_name: "Notification",
    message: "Claude needs your permission to use Bash",
  });
  expect(e.type).toBe("needs-input");
});

test("CC completion Notification -> turn-end without summary", () => {
  const e = mapClaudeHook("s", {
    hook_event_name: "Notification",
    message: "Claude is waiting for your input",
  });
  expect(e.type).toBe("turn-end");
  // the generic completion nudge must not clobber the agent's last real message
  expect(e.type === "turn-end" && e.summary).toBeUndefined();
});

test("CC UserPromptSubmit -> turn-start (working), summary from prompt", () => {
  const e = mapClaudeHook("s", { hook_event_name: "UserPromptSubmit", prompt: "refactor auth" });
  expect(e.type).toBe("turn-start");
  expect(e.type === "turn-start" && e.summary).toBe("refactor auth");
});

test("Codex agent-turn-complete -> turn-end, summary from last-assistant-message", () => {
  const e = mapCodexNotify("s", { type: "agent-turn-complete", "last-assistant-message": "ok" });
  expect(e.type).toBe("turn-end");
  expect(e.type === "turn-end" && e.summary).toBe("ok");
});

test("Codex approval event -> needs-input", () => {
  const e = mapCodexNotify("s", { type: "approval-requested" });
  expect(e.type).toBe("needs-input");
});
