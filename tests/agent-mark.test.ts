import { test, expect } from "bun:test";
import { AGENT_MARK } from "../web/src/components/agent-mark-data";

const AGENTS = ["claude-code", "codex", "opencode", "generic"] as const;

test("every agent kind has a mark", () => {
  for (const a of AGENTS) {
    expect(AGENT_MARK[a].path.length).toBeGreaterThan(10);
    expect(AGENT_MARK[a].title.length).toBeGreaterThan(0);
  }
});

test("vendor agents use vendor fill icons", () => {
  expect(AGENT_MARK["claude-code"].mode).toBe("fill");
  expect(AGENT_MARK.codex.mode).toBe("fill");
  expect(AGENT_MARK.opencode.mode).toBe("stroke");
  expect(AGENT_MARK.generic.mode).toBe("stroke");
});
