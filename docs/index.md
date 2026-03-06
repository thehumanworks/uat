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

- The npm release plan is complete and archived under `docs/tasks/done/`.
- The public npm package `@nothumanwork/uat` is available with `1.0.1` as the current `latest` tag.
- The completed stabilization backlog remains archived under `docs/tasks/done/`.

## Verification Baseline

Run from the repository root:

    npm run lint
    npm run build
    npm run smoke:help
    npm run smoke:compiled
