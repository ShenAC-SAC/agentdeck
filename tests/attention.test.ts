import { test, expect } from "bun:test";
import { attentionItems } from "../web/src/attention";
import type { Session } from "../src/types";

const s = (id: string, over: Partial<Session>): Session => ({
  id, agent: "claude-code", title: id, tmuxTarget: `${id}:0.0`, cwd: "/tmp",
  host: "local", state: "idle", lastActivityAt: 0, lastSummaryLine: "", ...over,
});

test("attentionItems keeps only actionable sessions, ranked and oldest-first", () => {
  const list = [
    s("idle1", { state: "idle" }),
    s("working1", { state: "working" }),
    s("stalled1", { state: "working", staleSince: 10, lastActivityAt: 100 }),
    s("waiting_new", { state: "waiting", lastActivityAt: 50 }),
    s("waiting_old", { state: "waiting", lastActivityAt: 10 }),
    s("error1", { state: "error", lastActivityAt: 5 }),
  ];
  const got = attentionItems(list).map((i) => i.session.id);
  expect(got).toEqual(["waiting_old", "waiting_new", "error1", "stalled1"]);
});
