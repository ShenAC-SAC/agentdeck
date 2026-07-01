import { test, expect } from "bun:test";
import { hubEventsUrl, claudeSettings, codexNotifyScript } from "../src/adapters/install";

test("hubEventsUrl carries sessionId and agent", () => {
  const u = hubEventsUrl(8799, "s1", "claude-code");
  expect(u).toContain("sessionId=s1");
  expect(u).toContain("agent=claude-code");
});

test("claudeSettings wires Stop and Notification to the hub", () => {
  const s = claudeSettings(8799, "s1");
  const stop = s.hooks.Stop as Array<{ hooks: Array<{ command: string }> }>;
  const notif = s.hooks.Notification as Array<{ hooks: Array<{ command: string }> }>;
  expect(stop[0]!.hooks[0]!.command).toContain("/events?sessionId=s1");
  expect(notif[0]!.hooks[0]!.command).toContain("agent=claude-code");
});

test("codexNotifyScript posts the notify payload to the hub", () => {
  const script = codexNotifyScript(8799, "s2");
  expect(script).toContain("sessionId=s2");
  expect(script).toContain("agent=codex");
  expect(script).toContain('"$1"');
});
