import { test, expect } from "bun:test";
import { workspaceName, groupByWorkspace } from "../web/src/workspace";
import type { Session } from "../src/types";

const s = (id: string, cwd: string, state: Session["state"], lastActivityAt = 0): Session => ({
  id,
  agent: "generic",
  title: id,
  tmuxTarget: `${id}:0.0`,
  cwd,
  host: "local",
  state,
  lastActivityAt,
  lastSummaryLine: "",
});

test("workspaceName is the basename", () => {
  expect(workspaceName("/Users/x/proj-a")).toBe("proj-a");
});

test("workspaceName treats empty or home-ish paths as home", () => {
  expect(workspaceName("")).toBe("home");
  expect(workspaceName("~")).toBe("home");
});

test("groups by cwd and floats workspaces with a waiting session first", () => {
  const groups = groupByWorkspace([
    s("a", "/p/idle", "idle"),
    s("b", "/p/hot", "waiting"),
    s("c", "/p/hot", "idle"),
  ]);
  expect(groups[0].cwd).toBe("/p/hot");
  expect(groups[0].waiting).toBe(1);
  expect(groups.map((g) => g.cwd)).toContain("/p/idle");
});

test("sorts sessions attention-first within each workspace", () => {
  const groups = groupByWorkspace([
    s("idle", "/p/a", "idle", 30),
    s("working", "/p/a", "working", 10),
    s("waiting", "/p/a", "waiting", 1),
  ]);
  expect(groups[0].sessions.map((session) => session.id)).toEqual(["waiting", "working", "idle"]);
});
