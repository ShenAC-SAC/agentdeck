import { expect, test } from "bun:test";
import { chmod, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { remoteClaudeSettings, remoteReportScript } from "../src/remote/report";
import { remoteAgentLaunch } from "../src/tmux/spawn";

test("report script bumps a seq and writes agent + base64 payload to tmux options", () => {
  const script = remoteReportScript("deck_1", "claude-code");
  expect(script).toContain("tmux -L deck");
  expect(script).toContain("@deck_event_seq");
  expect(script).toContain("@deck_event_agent");
  expect(script).toContain("@deck_event_payload");
  expect(script).toContain("@deck_event_queue");
  expect(script).toContain("base64");
  expect(script).toContain("claude-code");
  expect(script).toContain("deck_1");
});

test("remote claude settings pipe the hook JSON into the report script", () => {
  const cfg = remoteClaudeSettings("/tmp/deck-report.sh");
  const command = JSON.stringify(cfg);
  expect(command).toContain("/tmp/deck-report.sh");
  expect(command).toContain("UserPromptSubmit");
  expect(command).toContain("Stop");
  expect(command).toContain("Notification");
});

test("remoteAgentLaunch wires each agent to its remote reporter", () => {
  expect(remoteAgentLaunch("claude-code", "/tmp/r.sh")).toContain("claude --settings");
  expect(remoteAgentLaunch("codex", "/tmp/r.sh")).toContain("notify=");
  expect(remoteAgentLaunch("opencode", "/tmp/r.sh")).toContain("opencode");
  expect(remoteAgentLaunch("generic", "/tmp/r.sh")).toContain("bash");
});

test("report script appends events to a bounded queue", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-report-test-"));
  const state = join(dir, "state");
  const fakeTmux = join(dir, "tmux");
  const report = join(dir, "report.sh");
  await Bun.write(
    fakeTmux,
    [
      "#!/usr/bin/env bash",
      'state="$TMUX_FAKE_STATE"',
      'cmd="$3"',
      'if [ "$cmd" = "show-options" ]; then',
      '  opt="${@: -1}"',
      '  file="$state.${opt#@deck_event_}"',
      '  [ -f "$file" ] || exit 1',
      '  cat "$file"',
      "  exit 0",
      "fi",
      'if [ "$cmd" = "set-option" ]; then',
      '  opt="${@: -2:1}"',
      '  value="${@: -1}"',
      '  printf "%s" "$value" > "$state.${opt#@deck_event_}"',
      "  exit 0",
      "fi",
      "exit 2",
      "",
    ].join("\n"),
  );
  await chmod(fakeTmux, 0o755);
  await Bun.write(report, remoteReportScript("deck_1", "claude-code"));

  for (let i = 1; i <= 21; i++) {
    const proc = Bun.spawn(["bash", "-c", `printf '%s' "$DECK_PAYLOAD" | bash ${JSON.stringify(report)}`], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}`, TMUX_FAKE_STATE: state, DECK_PAYLOAD: `event-${i}` },
      stderr: "pipe",
    });
    expect(await proc.exited).toBe(0);
  }

  const seq = await Bun.file(`${state}.seq`).text();
  const queue = await Bun.file(`${state}.queue`).text();
  const entries = queue.split(";");
  expect(seq).toBe("21");
  expect(entries).toHaveLength(20);
  expect(entries[0].startsWith("2,claude-code,")).toBe(true);
  expect(entries.at(-1)?.startsWith("21,claude-code,")).toBe(true);
});
