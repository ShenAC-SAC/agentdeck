# Agent Instructions

## Project Map

AgentDeck is a macOS-first control deck for running multiple coding agents at once. It is an external observer, not an agent runtime: agents keep running in `tmux`, while AgentDeck watches their observable events and terminal output, then surfaces which session needs human attention.

The repo has four main surfaces:

- `bin/deck.tsx`: Ink CLI / TUI entrypoint.
- `bin/hub.ts`: starts the local hub server.
- `web/`: React dashboard served by the hub.
- `electron/`: native desktop shell, embedded terminal bridge, tray / Dock integration, and app icon assets.

Core runtime code lives under `src/`:

- `src/hub/`: source of truth for sessions. `registry.ts` owns session records, `state-machine.ts` maps adapter events to `working | waiting | idle | error`, `server.ts` exposes HTTP endpoints, `sse.ts` streams updates, `liveness.ts` reaps dead or stale sessions, and `rehydrate.ts` rebuilds sessions from tmux metadata.
- `src/adapters/`: maps agent-specific hook payloads into generic events. Claude Code and Codex get explicit adapters; `heuristic.ts` is the fallback for terminal-output changes.
- `src/tmux/`: private tmux socket integration (`tmux -L deck`), spawn args, metadata, and parsing.
- `src/agents/availability.ts`: local CLI detection.
- `src/remote/ssh.ts`: early remote shell helpers. Remote agent mode is intentionally not enabled yet.
- `src/types.ts`: shared session and agent types.

Frontend code lives under `web/src/`:

- `app.tsx`: main UI state and session selection.
- `components/`: workspace rail, session rows, embedded terminal, crew face, vendor marks.
- `attention.ts`, `workspace.ts`, `mood.ts`: pure presentation logic.
- `pty.ts`, `host.ts`: Electron bridge feature detection.
- `terminal-activity.ts`, `terminal-input.ts`: embedded terminal input behavior.

Electron-specific behavior:

- `electron/main.cjs`: starts the hub, creates the window/tray, owns native notifications, launches embedded ptys, and tracks unread attention count.
- `electron/preload.cjs`: exposes a small renderer bridge (`deckpty`, `deckdialog`, `deckapp`).
- `electron/attention-badge.cjs`: pure unread-attention logic. Session state stays `waiting`; badge count is only unread status.
- `electron/dev-launch.cjs`: creates a local `.agentdeck/AgentDeck.app` dev bundle so macOS shows AgentDeck identity instead of Electron.
- `electron/render-icon.cjs`: renders the app icon through Chromium to preserve transparent corners.

## Product Semantics

- AgentDeck is macOS-first and local-first today.
- `working`: the user has sent work to the agent and it is active.
- `waiting` / "Needs you": the agent has reached a handoff, approval, question, completion, or other point where the human should inspect or continue. Looking at the session may clear unread badges, but it must not turn the session back into `idle`.
- `idle` / "Resting": a fresh or inactive session with no current handoff.
- `error`: adapter or runtime failure state.
- Stale working sessions are derived from liveness, not from agent state.
- Remote hosts are visible as a product direction, but remote agent mode is not ready.

## Commands

Use the scripts that exist in `package.json`:

```bash
bun install
bun run app          # build web and launch the desktop app
bun run deck         # terminal UI
bun run deck gui     # hub + web dashboard
bun test
bun run typecheck
bun run web:build
bun run app:smoke
```

Before running the full test suite, stop any dev app or process using port `8799`; several server tests bind that port.

The current project has no formatter/linter script. Do not run broad hand-formatting. Keep diffs small and style-compatible with surrounding code.

## GitHub / Release Posture

This repository is in early alpha. Prefer from-source usage in docs. Do not add `.dmg`, signing, notarization, auto-update, or installer claims unless the packaging pipeline exists and is verified. Keep `private: true` until an actual npm/package publishing decision is made.

## Working Principles

### 1. Read before you write

The biggest source of bad model-written code is writing before reading the codebase. Read the files you are about to touch — read, not skim. Copy the patterns that already exist, and check the imports to see what the project actually depends on, so you do not reach for axios where everything is fetch. When you cannot find a pattern, ask instead of guessing.

### 2. Think before you code

Figure out what you are doing before you type. State your assumptions ("add authentication" is five different things, so name the one you picked) and name the tradeoffs. If something is genuinely confusing, stop and ask rather than filling the gap with plausible-looking code; that is exactly the code that passes a casual review and fails when it matters.

### 3. Simplicity

Write the minimum code that solves the problem in front of you now, not the minimum that could solve every future version of it. Resist premature abstraction, skip error handling for errors that cannot occur, and hardcode values until there is a real reason to configure them. The test: if the only reason something is abstracted is "in case we need to," you have over-built it.

### 4. Surgical changes

Your diff should be as small as the task allows. Do not touch what you were not asked to touch, match the existing style, and do not reformat; a formatter pass buries the three lines that matter inside three hundred that do not. The test is whether you can justify every changed line by the task. If a line is there because "while I was in there," revert it.

### 5. Verification

The gap between code that works and code you think works is testing. When fixing a bug, write the failing test first, watch it fail, then fix it; that is the only proof you fixed the cause and not the symptom. Test behavior that can actually break, not that a constructor sets a field. If something is hard to test, that is information about the design, not permission to skip it.

### 6. Goal-driven execution

Every task needs a success criterion before code is written. "Add validation" becomes "reject a missing or malformed email, return 400 with a clear message, and test both cases." For anything multi-step, state the plan first so the user can catch a wrong approach before you spend an hour building it.

### 7. Debugging

When something breaks, investigate; do not guess. Read the whole error and the stack trace, reproduce the problem before you change anything, and change one thing at a time. Do not paper over an unexpected null with a null check; find out why it is null, or the bug just moves somewhere quieter.

### 8. Dependencies

Every dependency is permanent code you do not control. Before adding one, ask whether the project or the standard library can already do it — `crypto.randomUUID()` over a uuid package. When you do add one, say why, so the choice is visible rather than smuggled into the manifest.

### 9. Communication

Say what you did and why, not just a block of code. Flag concerns even when you did exactly what was asked, and be precise about uncertainty: "I am not sure this library supports streaming" tells the user what to verify; "I think this should work" does not.

### 10. Common failure modes

A few patterns recur often enough to name. Catch yourself in any of these and the right move is to stop, not to push through:

- **The Kitchen Sink** — restructuring half the codebase while you are at it.
- **The Wrong Abstraction** — abstracting before you have copy-pasted twice.
- **The Optimistic Path** — handling the happy path and ignoring the 500.
- **The Runaway Refactor** — a fix that cascades across files.

## Conventions

### Commit titles

Use Conventional Commits:

```text
<type>: <summary>
<type>(<scope>): <summary>
```

- **type** is one of `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `perf` | `build` | `ci` | `spike`.
- **summary**: imperative mood, lowercase after the colon, no trailing period, <= 72 chars.
- One logical change per commit (see Principle 4). Do not bundle unrelated changes.
- Add a body only when the why is not obvious: blank line, wrap at ~72 chars, explain motivation and tradeoffs (Principle 2). Do not restate the diff (Principle 9).

Good:

```text
feat: add four-state session machine
fix: keep spawned processes from inheriting stale env
test: cover the approval-required path
```

Bad: `update code` / `fixes.` / `feat: add A, fix B, and refactor C` (three things at once).

### PR body

Write for the reviewer (Principle 9): someone should understand what changed, why, and how it was verified without reading the diff.

```md
## Summary
The change and its outcome, in 1-3 sentences. Lead with the point.

## Context
Why this change, and why now - the problem it solves and what triggered it.
Link the driving spec, plan, or issue.

## Approach & key decisions
How it works, the design choices that are not obvious from the diff, and the
alternatives you considered and rejected (Principle 2). This is what a
reviewer most needs and can least reconstruct alone.

## Scope
What this PR deliberately does and does not cover (Principle 4). Call out
anything intentionally left for a follow-up.

## Testing
What you verified and how - commands, results, and which cases are covered
versus still untested (Principle 5).

## Risks & impact
Blast radius, rollback or migration notes, and known limitations. Be precise
about anything you are unsure of (Principle 9).
```

- Lead with the point; no play-by-play.
- Scale each section to the change - a trivial PR can be terse - but Approach and Testing always earn their space.
- Drop a section only when it genuinely has nothing to say; never leave `N/A` placeholders.

### Naming

- Files: `kebab-case` (`state-machine.ts`, `deck-view.tsx`).
- Types and React components: `PascalCase`.
- Functions and variables: `camelCase`.
- Module-level constants: `UPPER_SNAKE_CASE`.

### Tooling

- Verify with the repo scripts listed above.
- Do not hand-reformat code. Keep diffs signal-only and let a future formatter own broad style if one is added.
