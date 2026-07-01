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
Every dependency is permanent code you do not control. Before adding one, ask whether the project or the standard library can already do it — crypto.randomUUID() over a uuid package. When you do add one, say why, so the choice is visible rather than smuggled into the manifest.

### 9. Communication
Say what you did and why, not just a block of code. Flag concerns even when you did exactly what was asked, and be precise about uncertainty: "I am not sure this library supports streaming" tells the user what to verify; "I think this should work" does not.

### 10. Common failure modes
A few patterns recur often enough to name. Catch yourself in any of these and the right move is to stop, not to push through:

- **The Kitchen Sink** — restructuring half the codebase while you are at it.
- **The Wrong Abstraction** — abstracting before you have copy-pasted twice.
- **The Optimistic Path** — handling the happy path and ignoring the 500.
- **The Runaway Refactor** — a fix that cascades across files.

---

## Conventions

### Commit titles

Use Conventional Commits:

```
<type>: <summary>
<type>(<scope>): <summary>
```

- **type** is one of `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `perf` | `build` | `ci` | `spike`.
- **summary**: imperative mood, lowercase after the colon, no trailing period, ≤ 72 chars.
- One logical change per commit (see Principle 4). Do not bundle unrelated changes.
- Add a body only when the *why* is not obvious: blank line, wrap at ~72 chars, explain motivation and tradeoffs (Principle 2). Do not restate the diff (Principle 9).

**Good:**

```
feat: add four-state session machine
fix: keep spawned processes from inheriting stale env
test: cover the approval-required path
```

**Bad:** `update code` / `fixes.` / `feat: add A, fix B, and refactor C` (three things at once).

### PR body

Write for the reviewer (Principle 9): someone should understand what changed, why, and how it was verified without reading the diff.

```
## Summary
The change and its outcome, in 1–3 sentences. Lead with the point.

## Context
Why this change, and why now — the problem it solves and what triggered it.
Link the driving spec, plan, or issue.

## Approach & key decisions
How it works, the design choices that are not obvious from the diff, and the
alternatives you considered and rejected (Principle 2). This is what a
reviewer most needs and can least reconstruct alone.

## Scope
What this PR deliberately does and does not cover (Principle 4). Call out
anything intentionally left for a follow-up.

## Testing
What you verified and how — commands, results, and which cases are covered
versus still untested (Principle 5).

## Risks & impact
Blast radius, rollback or migration notes, and known limitations. Be precise
about anything you are unsure of (Principle 9).
```

- Lead with the point; no play-by-play.
- Scale each section to the change — a trivial PR can be terse — but Approach and Testing always earn their space.
- Drop a section only when it genuinely has nothing to say; never leave `N/A` placeholders.

### Naming

- Files: `kebab-case` (`state-machine.ts`, `deck-view.tsx`).
- Types and React components: `PascalCase`.
- Functions and variables: `camelCase`.
- Module-level constants: `UPPER_SNAKE_CASE`.

### Tooling

- Format and lint with **Biome** (one dependency for both; configuration lands with the project scaffold).
- Do not hand-reformat code — let Biome own style so diffs stay signal-only (Principle 4).
