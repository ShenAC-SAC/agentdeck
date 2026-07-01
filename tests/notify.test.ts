import { test, expect } from "bun:test";
import { notifyText } from "../src/notify/notify";
import type { Session } from "../src/types";

const s: Session = {
  id: "s1",
  agent: "claude-code",
  title: "repo-foo",
  tmuxTarget: "deck:0.0",
  host: "local",
  state: "waiting",
  lastActivityAt: 0,
  lastSummaryLine: "approve?",
};

test("notifyText names the session and shows the summary", () => {
  const t = notifyText(s);
  expect(t.title).toContain("repo-foo");
  expect(t.body).toContain("approve?");
});

test("notifyText falls back to the agent name when there is no summary", () => {
  const t = notifyText({ ...s, lastSummaryLine: "" });
  expect(t.body).toContain("claude-code");
});
