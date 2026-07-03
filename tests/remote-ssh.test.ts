import { expect, test } from "bun:test";
import { controlPath, masterArgs, sshArgs } from "../src/remote/connection";
import { remoteAttachCommand, shQuote } from "../src/remote/ssh";

test("shQuote handles spaces and single quotes", () => {
  expect(shQuote("/srv/my app")).toBe("'/srv/my app'");
  expect(shQuote("/srv/bob's app")).toBe("'/srv/bob'\"'\"'s app'");
});

test("remoteAttachCommand builds an ssh attach command", () => {
  expect(remoteAttachCommand("devbox", "deck_1:0.0")).toEqual([
    "ssh",
    "-tt",
    "devbox",
    "tmux -L deck attach -t 'deck_1'",
  ]);
});

test("sshArgs reuses the ControlMaster socket for the alias", () => {
  const cp = controlPath("devbox");
  expect(sshArgs("devbox", "tmux -L deck list-sessions")).toEqual([
    "-o",
    "ControlMaster=auto",
    "-o",
    `ControlPath=${cp}`,
    "devbox",
    "tmux -L deck list-sessions",
  ]);
});

test("masterArgs opens a persistent background master", () => {
  const args = masterArgs("devbox");
  expect(args).toContain("-M");
  expect(args).toContain("-N");
  expect(args).toContain(`ControlPath=${controlPath("devbox")}`);
});
