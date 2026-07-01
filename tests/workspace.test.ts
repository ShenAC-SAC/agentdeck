import { test, expect } from "bun:test";
import { workspaceName, groupByWorkspace } from "../web/src/workspace";
import { defaultTerminalTitle, hostLabel, workspaceKey } from "../src/workspace";
import type { Session } from "../src/types";

const s = (
  id: string,
  cwd: string,
  state: Session["state"],
  lastActivityAt = 0,
  host: Session["host"] = "local",
): Session => ({
  id,
  agent: "generic",
  title: id,
  tmuxTarget: `${id}:0.0`,
  cwd,
  host,
  state,
  lastActivityAt,
  lastSummaryLine: "",
});

test("workspaceKey separates local and remote directories with the same cwd", () => {
  expect(workspaceKey("local", "/srv/app")).toBe("local\u0000/srv/app");
  expect(workspaceKey("ssh:devbox", "/srv/app")).toBe("ssh:devbox\u0000/srv/app");
});

test("hostLabel formats local and ssh host ids", () => {
  expect(hostLabel("local")).toBe("Local");
  expect(hostLabel("ssh:devbox")).toBe("devbox");
  expect(hostLabel("ssh:user@example.com")).toBe("user@example.com");
});

test("defaultTerminalTitle is human-readable and avoids deck ids", () => {
  expect(defaultTerminalTitle("claude-code", "local", "/Users/mac/learning/agentdeck")).toBe(
    "Claude Code · agentdeck",
  );
  expect(defaultTerminalTitle("generic", "ssh:devbox", "/srv/api")).toBe("Shell · api");
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
  expect(groups[0].key).toBe(workspaceKey("local", "/p/hot"));
  expect(groups[0].host).toBe("local");
  expect(groups[0].hostName).toBe("Local");
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

test("keeps workspaces separate when host differs but cwd matches", () => {
  const groups = groupByWorkspace([
    s("local", "/repo", "idle", 10, "local"),
    s("remote", "/repo", "idle", 20, "ssh:devbox"),
  ]);
  expect(groups).toHaveLength(2);
  expect(groups.map((g) => g.key).sort()).toEqual([
    workspaceKey("local", "/repo"),
    workspaceKey("ssh:devbox", "/repo"),
  ]);
  expect(groups.map((g) => g.hostName).sort()).toEqual(["Local", "devbox"]);
});
