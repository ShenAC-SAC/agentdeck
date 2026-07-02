import { expect, test } from "bun:test";
import { remoteClaudeSettings, remoteReportScript } from "../src/remote/report";

test("report script bumps a seq and writes agent + base64 payload to tmux options", () => {
  const script = remoteReportScript("deck_1", "claude-code");
  expect(script).toContain("tmux -L deck");
  expect(script).toContain("@deck_event_seq");
  expect(script).toContain("@deck_event_agent");
  expect(script).toContain("@deck_event_payload");
  expect(script).toContain("base64");
  expect(script).toContain("claude-code");
  expect(script).toContain("deck_1");
});

test("remote claude settings pipe the hook JSON into the report script", () => {
  const cfg = remoteClaudeSettings("/tmp/deck-report.sh");
  const command = JSON.stringify(cfg);
  expect(command).toContain("/tmp/deck-report.sh");
  expect(command).toContain("UserPromptSubmit");
  expect(command).toContain("Stop");
  expect(command).toContain("Notification");
});
