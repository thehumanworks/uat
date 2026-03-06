# Publish `@nothumanwork/uat`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must stay current as work proceeds or is closed out.

`PLANS.md` was not found in the repository on 2026-03-06, so this document follows the exec-plan skill contract directly.

## Purpose / Big Picture

This repository now ships a public npm package named `@nothumanwork/uat`. The published CLI gives downstream projects one entrypoint for site checks plus explicit installers for the managed pre-commit hook and GitHub Actions workflows. The latest patch release keeps the npm package page consumer-focused by moving repo-layout notes out of the published README and into `AGENTS.md`.

The release proof for this plan is:

    npm run lint
    npm run build
    npm run smoke:help
    npm run smoke:compiled
    npm pack --json
    npm view @nothumanwork/uat version
    npx @nothumanwork/uat@1.0.2 --help

The public registry now serves `1.0.0`, `1.0.1`, and `1.0.2`, with `1.0.2` as `latest`.

## Progress

- [x] (2026-03-06 13:52Z) Replaced the completed stabilization backlog with a release-focused ExecPlan and created active task specs in `docs/tasks/todo/`.
- [x] (2026-03-06 14:01Z) [Establish the release baseline](tasks/done/07-establish-release-baseline.md): package metadata now targets `@nothumanwork/uat`, TypeScript build configuration exists, `npm run lint` passes, and `npm run smoke:help` prints the source CLI help.
- [x] (2026-03-06 14:07Z) [Package the CLI and installers](tasks/done/08-package-cli-and-installers.md): the source and compiled CLIs support `check`, `init hooks`, `init github`, and `init all`; downstream templates live under `templates/`; and the repo-local hook plus CI workflows run through npm/Node instead of Bun.
- [x] (2026-03-06 14:08Z) Validated the package boundary with `npm pack --json` and a tarball-backed CLI smoke run before publishing.
- [x] (2026-03-06) The npm registry now serves `@nothumanwork/uat` publicly with versions `1.0.0` and `1.0.1`, and `latest` resolves to `1.0.1`.
- [x] (2026-03-06) Archived the final release task and updated the docs-first task indexes to show zero active tasks.
- [x] (2026-03-06) [Refresh the package README and republish](tasks/done/10-refresh-package-readme-and-republish.md): published `1.0.2` with the repo-layout guidance removed from the npm-facing README and preserved in `AGENTS.md`.

## Surprises & Discoveries

- Observation: the repository started as a repo-local Bun tool, not a publishable npm package.
  Evidence: the original `package.json` had no `bin` entry or build step, and the original hook plus workflow files invoked `bun main.ts` from this checkout.

- Observation: Node-based HTTPS smoke checks against some public sites are unreliable in this macOS environment because the Node TLS trust store cannot validate the remote certificate chain.
  Evidence: `node -e 'fetch("https://example.com")...'` failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while the compiled CLI succeeded against a local HTTP fixture.

- Observation: npm publish verification needs both authenticated metadata checks and a separate anonymous `npx` read-path check.
  Evidence: the release guidance now requires `npm access get status`, `npm dist-tag ls`, and a clean-temp-directory `npx @nothumanwork/uat@<version> --help`, because metadata and public reads do not always become available at the same time.

- Observation: the root `README.md` is the npm package page, so repo-layout notes placed there leak onto the published package page.
  Evidence: the package includes `README.md` in `package.json`, and the repo-level layout section in the root README was visible to npm consumers until moved out.

## Decision Log

- Decision: expose installers as explicit CLI subcommands rather than implicit side effects of `uat` itself.
  Rationale: running the checker should stay read-only by default, while writing `.git/hooks/pre-commit` or `.github/workflows/*.yml` must be an intentional user action with clear overwrite rules.
  Date/Author: 2026-03-06 / Codex

- Decision: standardize repository-local CI and hook verification on npm plus the built `dist/` artifact instead of Bun.
  Rationale: npm is the package publication path, and the published artifact must be validated in the same toolchain used to build and ship it.
  Date/Author: 2026-03-06 / Codex

- Decision: keep the repository package version aligned with the current public `latest` tag.
  Rationale: release docs and package metadata should match the version that downstream users resolve from npm.
  Date/Author: 2026-03-06 / Codex

- Decision: ship the README cleanup as patch release `1.0.2`.
  Rationale: the package code is unchanged, but the published npm page changed materially and deserves a traceable new release.
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

The npm packaging and release work is complete. The repository builds a publishable Node CLI, ships the downstream installer templates inside `templates/`, documents the npm-first workflow, and now publishes a package page that stays consumer-focused. There are no active tasks under `docs/tasks/todo/`.

## Context and Orientation

`main.ts` is the central CLI implementation. It owns top-level command parsing, the crawl loop, result formatting, report persistence, the optional Playwright browser pass loaded from `browser.ts`, and the downstream installer logic that renders files from `templates/`.

Repository-local automation lives in `setup-hooks.sh`, `hooks/pre-commit`, and `.github/workflows/`. Downstream package assets live in `templates/pre-commit`, `templates/uat-link-check.yml`, and `templates/uat-post-deploy-link-check.yml`.

The docs-first project state lives under `docs/`. This file remains the canonical execution log, and completed release tasks are archived under `docs/tasks/done/`.

## Plan of Work

No release work remains open under this plan. Future work should create a new task in `docs/tasks/todo/`, update `docs/tasks/index.md`, and append the new milestone to this file before implementation begins.

## Validation and Acceptance

Release closeout now meets all acceptance criteria:

`npm run lint` passes on the checked-in source tree.

`npm run build` produces a runnable `dist/main.js` CLI artifact.

`npm run smoke:help` and `npm run smoke:compiled` both print the expected command surface.

`npm pack --json` produces the publishable tarball containing `dist/`, `templates/`, and the package-facing `README.md`.

The npm registry reports `@nothumanwork/uat` as public with `latest: 1.0.2`, and anonymous `npx @nothumanwork/uat@1.0.2 --help` works for the published package.

## Idempotence and Recovery

`npm run lint`, `npm run build`, `npm run smoke:help`, `npm run smoke:compiled`, and `npm pack --json` are safe to re-run.

For npm auth, always use a temporary `NPM_CONFIG_USERCONFIG` file populated from `NODE_AUTH_TOKEN`, then delete it. After any future publish, verify both authenticated metadata and anonymous `npx` resolution before closing the release task.

If a future public read path lags after publish, keep the task open instead of republishing immediately. Only bump the version when the already-published artifact is confirmed wrong or when npm explicitly forbids reuse of the planned version.

## Artifacts and Notes

Registry state after the patch release:

    $ npm view @nothumanwork/uat version
    1.0.2

    $ npm view @nothumanwork/uat versions --json
    ["1.0.0", "1.0.1", "1.0.2"]

    $ npm access get status @nothumanwork/uat
    @nothumanwork/uat: public

    $ npm dist-tag ls @nothumanwork/uat
    latest: 1.0.2

    $ npx @nothumanwork/uat@1.0.2 --help
    Usage:
      uat check [options]
      uat init hooks [--dry-run] [--force] [--cwd <path>]

    $ npx @nothumanwork/uat@1.0.0 --help
    Usage:
      uat check [options]
      uat init hooks [--dry-run] [--force] [--cwd <path>]

## Interfaces and Dependencies

The published package exposes one executable named `uat` through the `bin` map in `package.json`. The default behavior remains the site checker implemented in `main.ts`, and the checker preserves the existing flag contract for `--base-url`, `--max-pages`, `--concurrency`, `--timeout`, `--no-external`, `--verbose`, `--output`, `--entry-points`, `--exit-on-failure`, and `--browser`.

`browser.ts` remains the Playwright-backed browser engine. `playwright` stays a runtime dependency because browser mode needs Chromium automation at execution time.

The installer surface lives in the published CLI. It writes a pre-commit hook to `.git/hooks/pre-commit` and workflow files to `.github/workflows/uat-link-check.yml` plus `.github/workflows/uat-post-deploy-link-check.yml`. The installers ship their source assets inside `templates/` and implement no-overwrite-by-default semantics with an explicit `--force` escape hatch.
