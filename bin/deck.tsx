#!/usr/bin/env bun
import { render } from "ink";
import { startHub } from "../src/hub/hub";
import { wireNotifications } from "../src/notify/notify";
import { DeckView } from "../src/tui/deck-view";
import type { Session } from "../src/types";

const PORT = 8799;
const [cmd, arg] = process.argv.slice(2);

function unreachable(): never {
  console.error(`could not reach the deck hub on :${PORT} — start it with 'deck' first`);
  process.exit(1);
}

if (cmd === "new") {
  if (!arg) {
    console.error("usage: deck new <claude-code|codex|opencode|generic>");
    process.exit(1);
  }
  const res = await fetch(`http://localhost:${PORT}/spawn`, {
    method: "POST",
    body: JSON.stringify({ agent: arg }),
  }).catch(() => null);
  if (!res || !res.ok) unreachable();
  const { id, target } = (await res.json()) as { id: string; target: string };
  console.log(`started ${arg} -> ${id} (${target})`);
} else if (cmd === "ls") {
  const res = await fetch(`http://localhost:${PORT}/sessions`).catch(() => null);
  if (!res || !res.ok) unreachable();
  const sessions = (await res.json()) as Session[];
  if (sessions.length === 0) console.log("(no sessions)");
  for (const s of sessions) console.log(`${s.state}\t${s.agent}\t${s.title}\t${s.tmuxTarget}`);
} else if (cmd === "gui") {
  // Open the web dashboard. Reuse a running hub if there is one; otherwise
  // start a headless hub (no TUI) and keep this process alive to host it.
  const reachable = await fetch(`http://localhost:${PORT}/sessions`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!reachable) {
    const hub = startHub(PORT);
    wireNotifications(hub.events);
  }
  Bun.spawn(["open", `http://localhost:${PORT}/`]);
  console.log(`AgentDeck GUI at http://localhost:${PORT}/  (Ctrl-C to stop)`);
  if (!reachable) await new Promise(() => {}); // hold the hub open
} else {
  // No subcommand: this process is the deck hub + TUI. Keep it running.
  const hub = startHub(PORT);
  wireNotifications(hub.events);
  render(<DeckView registry={hub.registry} events={hub.events} />);
}
