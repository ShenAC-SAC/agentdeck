<div align="center">

![AgentDeck overview](docs/media/overview.png)

![Status](https://img.shields.io/badge/status-early_alpha-d98c7a)
![Platform](https://img.shields.io/badge/platform-macOS-2f89ae)
![Runtime](https://img.shields.io/badge/runtime-Bun-ecb75f)
[![License: MIT](https://img.shields.io/badge/license-MIT-1f6b8c)](LICENSE)

[Why](#why-agentdeck) · [Features](#features) · [Quickstart](#quickstart) · [How it works](#how-it-works) · [Comparison](#how-it-compares) · [Roadmap](#roadmap)

</div>

---

## Why AgentDeck

Running one coding agent is easy. Running several turns into a tab-hunting
exercise: which terminal finished? Which one has been waiting twenty minutes for
an approval you never saw? Which one silently died?

Each vendor ships a great cockpit **for its own agent**. Nobody ships the layer
above — the one that answers a simpler question: *right now, across everything
I have running, where should my attention go?*

AgentDeck is that layer. It is deliberately **not** another agent, IDE, or
terminal replacement. Your agents keep running in real tmux sessions on your
machine; AgentDeck watches them all and routes your attention.

**Start work. Walk away. Come back only when something needs judgment.**

## Who it's for

AgentDeck earns its place when your day looks like this:

- several agent sessions in flight at once, across multiple repos;
- a mix of vendors — Claude Code here, Codex there, opencode for the third thing;
- long-running work where you'd rather leave than watch, but must be called
  back for approvals, questions, and failures.

For a single agent in a single window, your vendor's own app is great. With
several sessions, multiple vendors, and a few repos, the deck starts paying rent.

## Features

- **One deck, every vendor** — Claude Code, Codex, opencode, and plain shell
  sessions in a single workspace-aware dashboard.
- **Needs-you triage** — an attention panel ranks what's actionable: waiting
  for input first, then errors, then stalled sessions, oldest first.
- **Walk-away notifications** — native macOS notifications when a session
  needs approval, asks a question, errors, or stalls. Clicking one opens that
  exact session.
- **Unread badges** — tray and Dock badges track attention you haven't looked
  at yet.
- **Embedded terminals** — open any session inline and keep typing; no hunting
  for the original window.
- **Sessions outlive the app** — agents run in a private tmux socket, so
  quitting or relaunching AgentDeck never kills your work. On restart, live
  sessions reappear with their names intact.
- **Liveness you can trust** — dead sessions disappear from the deck; a
  "working" session whose output has been frozen for two minutes gets flagged
  as stalled.
- **Names that mean something** — sessions are auto-titled from their first
  prompt, grouped by repo, and manual renames stick.

## The state model

AgentDeck keeps the model small on purpose:

| State | Meaning |
| --- | --- |
| **Working** | You sent work; the agent is on it. |
| **Needs you** | The agent hit a handoff: done, approval, or question. |
| **Resting** | Nothing active, nothing pending. |
| **Error** | Something failed. |

## Quickstart

Requirements: macOS, [Bun](https://bun.sh), tmux 3.x, and whichever agent CLIs
you use (Claude Code, Codex, opencode — all optional).

```bash
git clone https://github.com/ShenAC-SAC/agentdeck.git
cd agentdeck
bun install
bun run app        # desktop app
```

Or drive it from the CLI/TUI:

```bash
bun run deck                    # TUI
bun run deck new claude-code    # spawn an agent session
bun run deck new codex
bun run deck new opencode
bun run deck new generic        # plain shell
bun run deck ls
```

> **Status:** early alpha, macOS-first, local sessions only. Run-from-source is
> the supported install path today; a packaged `.dmg` is on the roadmap.

## How it works

AgentDeck is an **external observer**, not an agent runtime. Nothing about your
agents changes; the deck watches from above.

```
┌────────────────  AgentDeck app (Electron + React)  ────────────────┐
│   workspace rail · attention panel · embedded terminals · badges   │
└──────────────▲──────────────────────────────────────▲──────────────┘
               │ HTTP + SSE                           │ node-pty
┌──────────────┴───────────────┐        ┌─────────────┴──────────────┐
│         Bun hub (:8799)      │        │   tmux -L deck (private)   │
│  registry · liveness sweeper │◄───────│   one session per agent    │
│  adapters · notifications    │        │   — survives the UI        │
└──────────────▲───────────────┘        └─────────────▲──────────────┘
               │ hooks & heuristics                   │
           Claude Code  ·  Codex  ·  opencode  ·  plain shells
```

- Agent sessions live in tmux on a private socket (`tmux -L deck`), so they
  survive the UI — and the UI can always reattach.
- Claude Code and Codex **hooks** map native agent events into one shared state
  machine; terminal-output heuristics cover generic shells.
- A liveness sweeper reaps dead sessions and flags stalled ones.
- The Bun hub serves state over HTTP/SSE; React renders it; Electron adds the
  macOS shell, notifications, badges, and embedded terminals.

## How it compares

- **Claude Code desktop / Codex app** — excellent cockpits for their own agent,
  including parallel sessions. But each shows only its own slice, and their
  remote stories route through their own surfaces with separately-siloed
  session histories. AgentDeck is the neutral pane above all vendors, with your
  own tmux as the single substrate.
- **claude-squad and other TUI managers** — closest neighbours, and good ones.
  AgentDeck bets on a different shape: a desktop app organized around
  *attention* — native notifications, unread badges, needs-you triage — rather
  than a terminal UI organized around session switching.
- **tmux by hand** — the baseline we love and build on. AgentDeck is what the
  tmux grid can't be: state-aware, vendor-aware, and quiet until something
  actually needs you.

## Development

```bash
bun test              # free port 8799 first if a dev app is running
bun run typecheck
bun run web:build
bun run app:smoke     # headless wiring check
```

## Roadmap

Ordered by intent — lifecycle first, then remote:

- [ ] **Session lifecycle** — dead sessions become durable, browsable records
      instead of vanishing; one-click resume for agents that support it
      (`claude --resume` first).
- [ ] **Session timeline** — per-session history of state transitions.
- [ ] **Remote hosts** — manage tmux-backed agent sessions on your own Linux
      servers over SSH: spawn, watch, get notified, reattach. Cross-vendor,
      on your hardware.
- [ ] **Packaged macOS app** — signed `.dmg`, no more run-from-source.
- [ ] Smarter stuck/looping detection.

**Non-goals:** an IDE, a terminal emulator, an orchestration framework,
analytics dashboards, or any vendor-exclusive feature that breaks neutrality.

## License

[MIT](LICENSE) © 2026 AochenShen99
