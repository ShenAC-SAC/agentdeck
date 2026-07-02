# ⚓ AgentDeck

**One deck for every coding agent.** See who's working, who's stuck, and who needs you — across Claude Code, Codex, opencode, and plain shells — from a single control plane.

> **Status:** early / alpha. macOS-first. Local sessions only (remote hosts are on the roadmap). Expect rough edges.

![AgentDeck overview](docs/media/overview.png)

## Why

You can *run* six coding agents at once. You can't *watch* six at once. Each one lives in its own terminal, quietly finishing, quietly blocking on a permission prompt, or quietly going in circles — and you find out only when you tab over to check.

AgentDeck raises your **attention ceiling**: instead of babysitting two or three agents by staring at them, you manage six or eight **by exception**. It watches all of them and surfaces the one judgment that matters — *who needs you right now* — so you can start work and actually walk away until it pings you.

It's a **neutral** control plane. It doesn't care which vendor's agent you run; it treats Claude Code, Codex, opencode, and a bare shell the same way. No agent gets promoted over another.

## What it does

- **Unified deck** — every session as a card: agent, workspace, state (working / waiting / resting / error), and last message.
- **Attention triage** — a "who needs you" panel ranks blocked and waiting agents first and lets you jump straight to one; when nothing needs you it says so ("All steady — you can walk away").
- **Liveness you can trust** — dead sessions are reaped automatically (no ghost cards), and an agent whose terminal has gone silent while "working" gets flagged as possibly stuck.
- **Embedded terminals** — open any session inline and type straight into it; no window-hopping.
- **Native notifications** — get pinged (clickable → jumps to the session) only for real blocks, not for an agent that simply finished.
- **Per-workspace grouping** — sessions are grouped by the project directory they run in, so one repo's agents sit together.

## How it works

AgentDeck is an **external observer**, not a wrapper. It never touches an agent's internals:

- A small **hub** (Bun) holds the source of truth: a registry + state machine.
- Sessions run in **tmux** on a private socket (`tmux -L deck`), so they survive the UI and each other.
- State comes from each agent's observable footprint: **hooks/notifications** (Claude Code, Codex), a universal **`capturePane`** fallback, and the shared **filesystem/git** of the workspace as the join key.
- A **web dashboard** (React) and an **Electron desktop app** render the same hub over SSE.

## Requirements

- **macOS** (native notifications and the embedded terminal are mac-focused today)
- [**Bun**](https://bun.sh)
- **tmux** (3.x)
- For the desktop app, the repo's bundled **Electron** + **node-pty** (installed via `bun install`)

## Quickstart

```bash
git clone <your-fork-url> agentdeck
cd agentdeck
bun install

# Desktop app (recommended):
bun run app

# …or the web dashboard + headless hub:
bun run deck gui

# …or the terminal UI:
bun run deck
```

Spawn and inspect sessions from the CLI (a hub must be running):

```bash
bun run deck new claude-code   # start a Claude Code session
bun run deck new codex         # …or Codex, opencode, generic
bun run deck ls                # list sessions and their states
```

## Development

```bash
bun test              # test suite
bun run typecheck     # tsc (root, no DOM) + web (DOM)
bun run web:build     # build the web bundle
```

## Roadmap

- **Remote hosts** — attach agents running over SSH.
- **Ledger** — durable cross-agent history: archive finished sessions, resume (`claude --resume` / `codex resume`).
- **Cross-agent signals** — collision detection ("two agents just edited `auth.ts`"), stuck/looping detection, review-risk.
- **Packaging** — a signed `.dmg`.

## License

[MIT](LICENSE) © 2026 AochenShen99
