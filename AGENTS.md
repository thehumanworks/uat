# Repository Guidance

This repository uses a docs-first workflow layout.

- Start at `docs/index.md` for the documentation map.
- Active task specs live under `docs/tasks/todo/`.
- Completed task specs live under `docs/tasks/done/`.
- `docs/EXECPLAN.md` remains the canonical execution log for long-running work and should stay in sync with the task docs when work is in flight.

When you move or add docs, update `docs/index.md` and `docs/tasks/index.md` in the same change.

For code changes, verify with the smallest relevant command-driven checks first. The current baseline smoke command is:

    bun main.ts --help
