import { expect, test } from "bun:test";
import { visibleAgentChoices } from "../web/src/agent-options";
import type { AgentAvailability } from "../web/src/api";

const agents: AgentAvailability[] = [
  { agent: "claude-code", label: "Claude Code", command: "claude", available: true },
  { agent: "codex", label: "Codex", command: "codex", available: false },
  { agent: "opencode", label: "opencode", command: "opencode", available: false },
  { agent: "generic", label: "Shell", command: "shell", available: true },
];

test("visibleAgentChoices hides local-unavailable agents when no remote host exists", () => {
  expect(visibleAgentChoices(agents, false).map((a) => a.agent)).toEqual(["claude-code", "generic"]);
});

test("visibleAgentChoices shows all supported agents when remote hosts can run them", () => {
  expect(visibleAgentChoices(agents, true).map((a) => a.agent)).toEqual([
    "claude-code",
    "codex",
    "opencode",
    "generic",
  ]);
});
