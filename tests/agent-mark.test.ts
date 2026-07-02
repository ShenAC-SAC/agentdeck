import { test, expect } from "bun:test";
import { siClaude, siOpenai } from "simple-icons";
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
  expect(AGENT_MARK.opencode.mode).toBe("fill");
  expect(AGENT_MARK.generic.mode).toBe("stroke");
});

test("agent marks match the visual language", () => {
  expect(AGENT_MARK["claude-code"].path).toBe(siClaude.path);
  expect(AGENT_MARK.codex.path).toBe(siOpenai.path);
  expect(AGENT_MARK.opencode.title).toBe("OpenCode");
  expect(AGENT_MARK.opencode.path).toContain("M18 4.8H6V19.2H18V4.8");
  expect(AGENT_MARK.opencode.secondaryPath).toContain("M18 19.2H6V9.6H18V19.2Z");
  expect(AGENT_MARK.opencode.fillRule).toBe("evenodd");
  expect(AGENT_MARK.opencode.path).not.toBe(siClaude.path);
  expect(AGENT_MARK.opencode.path).not.toBe(siOpenai.path);
  expect(AGENT_MARK.generic.path).toContain("M3 5");
});
