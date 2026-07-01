import { test, expect } from "bun:test";
import { EventEmitter } from "node:events";
import { notifyText, wireNotifications } from "../src/notify/notify";
import type { Session } from "../src/types";

const s: Session = {
  id: "s1",
  agent: "claude-code",
  title: "repo-foo",
  tmuxTarget: "deck:0.0",
  cwd: "/tmp",
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

test("wireNotifications no-ops under Electron (main process owns notifications)", () => {
  const prev = process.env.DECK_ELECTRON;
  process.env.DECK_ELECTRON = "1";
  const ev = new EventEmitter();
  let fired = 0;
  wireNotifications(ev, () => {
    fired++;
  });
  ev.emit("update", s);
  ev.emit("update", { ...s, state: "error" });
  if (prev == null) delete process.env.DECK_ELECTRON;
  else process.env.DECK_ELECTRON = prev;
  expect(fired).toBe(0);
});

test("wireNotifications fires on waiting and error when not under Electron", () => {
  const prev = process.env.DECK_ELECTRON;
  delete process.env.DECK_ELECTRON;
  const ev = new EventEmitter();
  const fired: string[] = [];
  wireNotifications(ev, (x) => fired.push(x.state));
  ev.emit("update", s);
  ev.emit("update", { ...s, state: "error" });
  ev.emit("update", { ...s, state: "idle" });
  if (prev == null) delete process.env.DECK_ELECTRON;
  else process.env.DECK_ELECTRON = prev;
  expect(fired).toEqual(["waiting", "error"]);
});
