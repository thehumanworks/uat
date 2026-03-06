# Docs Index

This repository documents `uat`, short for UI Automated Testing, using a docs-first layout modeled on the Harness Engineering style of keeping execution state, task specs, and repository guidance easy to discover from one place.

## Core Documents

- [`../README.md`](../README.md): product overview, setup, usage, and CI details
- [`EXECPLAN.md`](EXECPLAN.md): living execution log and verification history
- [`../AGENTS.md`](../AGENTS.md): repository-specific guidance for future agents

## Task Tracking

- [`tasks/index.md`](tasks/index.md): task catalog and status overview
- [`tasks/todo/`](tasks/todo/): active work items
- [`tasks/done/`](tasks/done/): completed task specs and historical source-of-truth records

## Current State

- Milestones 1 and 2 of the npm release plan are complete and archived in `docs/tasks/done/`.
- One active release task remains under `docs/tasks/todo/`: publish and verify `@nothumanwork/uat@1.0.0`.
- The completed stabilization backlog remains archived under `docs/tasks/done/`.

## Verification Baseline

Run from the repository root:

    npm run lint
    npm run build
    npm run smoke:help
