import { expect, test } from "bun:test";
import { remoteAttachCommand, remoteNewSessionCommand, sshTargetFromHost, shQuote } from "../src/remote/ssh";

test("sshTargetFromHost accepts ssh host ids only", () => {
  expect(sshTargetFromHost("ssh:devbox")).toBe("devbox");
  expect(sshTargetFromHost("ssh:user@example.com")).toBe("user@example.com");
  expect(sshTargetFromHost("local")).toBeUndefined();
});

test("shQuote handles spaces and single quotes", () => {
  expect(shQuote("/srv/my app")).toBe("'/srv/my app'");
  expect(shQuote("/srv/bob's app")).toBe("'/srv/bob'\"'\"'s app'");
});

test("remoteNewSessionCommand builds remote tmux command", () => {
  expect(remoteNewSessionCommand("deck_1", "/srv/my app")).toBe(
    "tmux -L deck new-session -d -s 'deck_1' -c '/srv/my app' 'exec ${SHELL:-bash}'",
  );
});

test("remoteAttachCommand builds an ssh attach command", () => {
  expect(remoteAttachCommand("devbox", "deck_1:0.0")).toEqual([
    "ssh",
    "-tt",
    "devbox",
    "tmux -L deck attach -t 'deck_1'",
  ]);
});
