import { test, expect } from "bun:test";
import { tmux } from "../src/tmux/tmux";
import { vettedConfig } from "../src/tmux/config";

const hasTmux = Bun.which("tmux") != null;

test("vetted config enables true color, extended keys, big scrollback", () => {
  const c = vettedConfig();
  expect(c).toContain("RGB");
  expect(c).toContain("extended-keys on");
  expect(c).toContain("history-limit 50000");
});

test.skipIf(!hasTmux)("newSession then listPanes sees it on the deck socket", async () => {
  const name = "deck_it_test";
  try {
    await tmux.newSession(name, "sleep 5");
    const panes = await tmux.listPanes();
    expect(panes.some((p) => p.target.startsWith(`${name}:`))).toBe(true);
  } finally {
    await tmux.run(["kill-session", "-t", name]).catch(() => {});
  }
});

test.skipIf(!hasTmux)("switchClient requires an attached deck tmux client", async () => {
  const name = "deck_jump_no_client";
  try {
    await tmux.newSession(name, "sleep 5");
    expect(tmux.switchClient(`${name}:0.0`)).rejects.toThrow("no attached deck tmux client");
  } finally {
    await tmux.run(["kill-session", "-t", name]).catch(() => {});
  }
});
