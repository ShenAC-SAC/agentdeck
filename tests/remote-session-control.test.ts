import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { remoteRenameSessionCommand } from "../src/remote/session-control";

test("remoteRenameSessionCommand rolls back the title if locking fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-session-control-test-"));
  const log = join(dir, "tmux.log");
  const tmux = join(dir, "tmux");
  writeFileSync(
    tmux,
    `#!/bin/sh
if [ "$3" = "show-options" ]; then
  if [ "$7" = "@deck_title" ]; then
    printf '%s\\n' 'Old title'
    exit 0
  fi
  if [ "$7" = "@deck_title_locked" ]; then
    printf '%s\\n' '0'
    exit 0
  fi
fi
if [ "$3" = "set-option" ]; then
  printf '%s:%s\\n' "$6" "$7" >> ${JSON.stringify(log)}
  if [ "$6" = "@deck_title_locked" ] && [ "$7" = "1" ]; then
    echo 'lock failed' >&2
    exit 2
  fi
  exit 0
fi
exit 1
`,
  );
  chmodSync(tmux, 0o755);

  const proc = Bun.spawn(["bash", "-c", remoteRenameSessionCommand("deck_1", "New title")], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}` },
  });
  await new Response(proc.stdout).text();
  await new Response(proc.stderr).text();

  expect(await proc.exited).toBe(2);
  expect(readFileSync(log, "utf8").trim().split("\n")).toEqual([
    "@deck_title:New title",
    "@deck_title_locked:1",
    "@deck_title:Old title",
    "@deck_title_locked:0",
  ]);
});
