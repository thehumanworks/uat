# Establish Release Baseline

## Goal

Turn the repository from a repo-local tool into a package candidate with explicit release planning and baseline quality gates. This task is complete when the release ExecPlan is current, the active task queue exists in `docs/tasks/todo/`, the package metadata targets `@nothumanwork/uat`, and the repository has a working lint command plus a source-level smoke command.

## Why This Matters

The package cannot be published safely until the project has a repeatable validation path and a durable task map. The previous docs were focused on the completed stabilization backlog and left no active source of truth for npm release work. The package metadata also still described an unpublished repo-local tool rather than a scoped npm package.

## Files Changed

- `docs/EXECPLAN.md`
- `docs/index.md`
- `docs/tasks/index.md`
- `docs/tasks/todo/index.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `biome.json`
- `AGENTS.md`

## What Changed

The ExecPlan now tracks the npm package release instead of the completed stabilization backlog. The active task queue was created under `docs/tasks/todo/`, and the package metadata now targets the scoped package name `@nothumanwork/uat` with a future `bin` mapping, public publish config, and npm scripts for linting, building, and source smoke checks. TypeScript build configuration and a Biome lint configuration were added so release work has a repeatable baseline quality gate.

## Validation

Run from the repository root:

    npm install
    npm run lint
    npm run smoke:help

Success criteria:

- `npm install` completes without dependency or audit failures.
- `npm run lint` exits 0.
- `npm run smoke:help` prints the current source CLI help through `tsx`.

## Completion Notes

- Status: completed on 2026-03-06 14:01Z
- Follow-on work: `docs/tasks/todo/02-package-cli-and-installers.md`
