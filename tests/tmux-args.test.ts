import { test, expect } from "bun:test";
import { newSessionArgs } from "../src/tmux/tmux";
import { claudeLaunchCommand } from "../src/tmux/spawn";

test("newSessionArgs includes -c cwd and -d -s name and the command", () => {
  const args = newSessionArgs("deck_1", "bash run.sh", { cwd: "/proj/a" });
  expect(args).toContain("new-session");
  const cwdIndex = args.indexOf("-c");
  expect(args[cwdIndex + 1]).toBe("/proj/a");
  expect(args).toContain("deck_1");
  expect(args.at(-1)).toBe("bash run.sh");
});

test("newSessionArgs keeps cwd with spaces as one argv item", () => {
  const args = newSessionArgs("deck_1", "bash run.sh", { cwd: "/tmp/my project" });
  const cwdIndex = args.indexOf("-c");
  expect(args[cwdIndex + 1]).toBe("/tmp/my project");
});

test("newSessionArgs prepends -f config and omits -c when no cwd", () => {
  const args = newSessionArgs("d", "cmd", { configPath: "/x.conf" });
  expect(args.slice(0, 2)).toEqual(["-f", "/x.conf"]);
  expect(args).not.toContain("-c");
});

test("claudeLaunchCommand adds --resume before settings when given a native session id", () => {
  expect(claudeLaunchCommand("/tmp/deck.claude-settings.json", "native-1")).toBe(
    `exec claude --resume 'native-1' --settings "/tmp/deck.claude-settings.json"`,
  );
  expect(claudeLaunchCommand("/tmp/deck.claude-settings.json")).toBe(
    `exec claude --settings "/tmp/deck.claude-settings.json"`,
  );
});
