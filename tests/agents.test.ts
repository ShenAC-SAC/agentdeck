import { expect, test } from "bun:test";
import { detectLocalAgents } from "../src/agents/availability";

test("detectLocalAgents marks installed agent CLIs", async () => {
  const agents = await detectLocalAgents(async (cmd) =>
    cmd === "claude" || cmd === "codex" ? `/bin/${cmd}` : "",
  );
  expect(agents.find((a) => a.agent === "claude-code")?.available).toBe(true);
  expect(agents.find((a) => a.agent === "codex")?.available).toBe(true);
  expect(agents.find((a) => a.agent === "opencode")?.available).toBe(false);
  expect(agents.find((a) => a.agent === "generic")?.available).toBe(true);
});

test("generic shell is always available", async () => {
  const agents = await detectLocalAgents(async () => "");
  expect(agents.find((a) => a.agent === "generic")?.available).toBe(true);
});
