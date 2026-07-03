import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { remoteListSessionsCommand } from "../src/remote/list-sessions";

async function runWithFakeTmux(mode: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const dir = mkdtempSync(join(tmpdir(), "deck-list-test-"));
  const tmux = join(dir, "tmux");
  writeFileSync(
    tmux,
    `#!/bin/sh
case ${JSON.stringify(mode)} in
  ok)
    printf '%s\\n' 'deck_1|codex|api|/repo|0|||'
    exit 0
    ;;
  empty)
    echo 'error connecting to /tmp/tmux-501/deck (No such file or directory)' >&2
    exit 1
    ;;
  fail)
    echo 'tmux: unknown option -- z' >&2
    exit 2
    ;;
  denied)
    echo 'error connecting to /tmp/tmux-501/deck (Permission denied)' >&2
    exit 1
    ;;
esac
`,
  );
  chmodSync(tmux, 0o755);
  const proc = Bun.spawn(["bash", "-c", remoteListSessionsCommand()], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}` },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

test("remote list command returns rows on success", async () => {
  const result = await runWithFakeTmux("ok");
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("deck_1|codex|api|/repo");
});

test("remote list command treats an absent tmux server as empty reachable output", async () => {
  const result = await runWithFakeTmux("empty");
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
});

test("remote list command preserves real tmux failures", async () => {
  const result = await runWithFakeTmux("fail");
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("unknown option");
});

test("remote list command does not treat tmux socket permission errors as empty", async () => {
  const result = await runWithFakeTmux("denied");
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("Permission denied");
});
