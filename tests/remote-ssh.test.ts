import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeMaster, controlPath, ensureMaster, masterArgs, sshArgs } from "../src/remote/connection";
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

test("ensureMaster waits for a successful control check after ssh launcher exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-ssh-test-"));
  const checks = join(dir, "checks");
  const fakeSsh = join(dir, "ssh");
  const alias = `deck-test-${Date.now()}`;
  writeFileSync(
    fakeSsh,
    `#!/bin/sh
if [ "$1" = "-O" ] && [ "$2" = "check" ]; then
  count=$(cat ${JSON.stringify(checks)} 2>/dev/null || echo 0)
  count=$((count + 1))
  printf '%s' "$count" > ${JSON.stringify(checks)}
  if [ "$count" -lt 2 ]; then
    echo 'Control socket connect: No such file or directory' >&2
    exit 255
  fi
  echo 'Master running (pid=123)'
  exit 0
fi
if [ "$1" = "-O" ] && [ "$2" = "exit" ]; then
  exit 0
fi
exit 0
`,
  );
  chmodSync(fakeSsh, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}:${originalPath ?? ""}`;
  try {
    await ensureMaster(alias);
    expect(readFileSync(checks, "utf8")).toBe("2");
  } finally {
    await closeMaster(alias);
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
