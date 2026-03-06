# Publish `@nothumanwork/uat`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` was not found in the repository on 2026-03-06, so this document follows the exec-plan skill contract directly.

## Purpose / Big Picture

After this plan is complete, this repository will ship a public npm package named `@nothumanwork/uat` that can do three concrete things from a downstream project without copying this repo: run the site checker from a CLI, install a managed pre-commit hook into the current Git repository, and install GitHub Actions workflow files into `.github/workflows/` without silently overwriting user-owned files.

The user-visible proof is a full release flow. From a clean checkout, `npm run lint`, `npm run build`, and the relevant smoke tests must pass locally. `npm pack` must produce a tarball containing the compiled CLI and installer templates. `npm publish --access public` must succeed with the scoped package name, and a registry-backed smoke run such as `npx @nothumanwork/uat@1.0.0 --help` or `npx @nothumanwork/uat@1.0.0 check --help` must work.

## Progress

- [x] (2026-03-06 13:52Z) Replaced the completed stabilization backlog with a release-focused ExecPlan and created active task specs in `docs/tasks/todo/`.
- [x] (2026-03-06 14:01Z) [Establish the release baseline](tasks/done/07-establish-release-baseline.md): package metadata now targets `@nothumanwork/uat`, TypeScript build configuration exists, `npm run lint` passes, and `npm run smoke:help` prints the source CLI help.
- [ ] Implement the publishable CLI surface so `uat` supports runtime checks plus explicit `init hooks`, `init github`, and `init all` installers.
- [ ] Validate the packaged artifact with `npm run lint`, `npm run build`, smoke commands, and `npm pack`.
- [ ] Publish `@nothumanwork/uat@1.0.0` to npm with public access and capture registry-backed verification evidence.
- [ ] Update the repository docs, AGENTS guidance, and task archive to match the shipped package behavior.
- [ ] Commit and push each completed milestone with `jj` after its validation passes.

## Surprises & Discoveries

- Observation: the repository is not publishable to npm in its current form because the package has no `bin` entry, no build output, and the source CLI is explicitly Bun-only.
  Evidence: `package.json` previously exposed only repository-local scripts, and `main.ts` starts with `#!/usr/bin/env bun` and help text that says `Usage: bun main.ts [options]`.

- Observation: the current hook and workflow assets are repository-internal, not downstream-installable.
  Evidence: `setup-hooks.sh` copies `hooks/pre-commit` into `.git/hooks`, and both workflow files run `bun main.ts` from a checkout of this repository instead of invoking an installed package.

- Observation: the package name `@nothumanwork/uat` is not present on the public npm registry as of 2026-03-06.
  Evidence: `npm view @nothumanwork/uat version` returned `E404 Not Found`.

## Decision Log

- Decision: keep the first published version at `1.0.0`.
  Rationale: the repository already advertises `1.0.0`, the package has never been published under this scope, and there is no registry conflict to force a version bump before the first release.
  Date/Author: 2026-03-06 / Codex

- Decision: expose installers as explicit CLI subcommands rather than implicit side effects of `uat` itself.
  Rationale: running the checker should stay read-only by default, while writing `.git/hooks/pre-commit` or `.github/workflows/*.yml` must be an intentional user action with clear overwrite rules.
  Date/Author: 2026-03-06 / Codex

- Decision: standardize release work on npm-driven quality gates even if some source-oriented scripts continue to use the existing TypeScript entrypoints during the transition.
  Rationale: npm is the package publication path, and the published artifact must be validated in the same toolchain used to build and ship it.
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

This plan replaces the earlier stabilization backlog, which is already archived under `docs/tasks/done/`. The repository enters this phase with the crawler fixes already merged and verified, but without npm-ready packaging. The first milestone is now complete: the repo has an active release plan, an archived baseline task record, scoped package metadata, and npm-based lint plus source-smoke commands. The remaining work is implementation-heavy: shipping the installable CLI surface, validating the tarball contents, and publishing the first scoped npm release.

## Context and Orientation

`main.ts` is still the central CLI implementation. It owns argument parsing, the crawl loop, result formatting, report persistence, and the optional Playwright browser pass loaded from `browser.ts`. `setup-hooks.sh` and `hooks/pre-commit` implement the current repository-local hook flow. `.github/workflows/uat-link-check.yml` and `.github/workflows/post-deploy-link-check.yml` are the current repository-local CI examples. `README.md` is the main product document. `package.json`, `package-lock.json`, and `bun.lock` describe the dependency and script surface.

The docs-first project state lives under `docs/`. This file is the canonical execution log. Active task specs live under `docs/tasks/todo/`, completed task specs under `docs/tasks/done/`, and `docs/tasks/index.md` plus `docs/index.md` must be updated whenever the task layout changes. `AGENTS.md` is repo-wide guidance and must capture high-value release learnings as they are confirmed.

The key architectural shift in this plan is from a repository tool to a package artifact. A package artifact is the tarball published to npm and later installed by `npm install`, `npm exec`, or `npx`. To make that work, the package needs a compiled executable in `dist/`, a `bin` mapping in `package.json`, installer templates that are shipped in the tarball, and commands that behave safely when run in someone else's repository.

## Plan of Work

Milestone 1 establishes release scaffolding. Keep `main.ts` and `browser.ts` as the source of truth, but change the package metadata so the repository can build a `dist/` artifact later. Add TypeScript build configuration and a linter command, then update the plan/task docs so future sessions know the target command structure and validation path.

Milestone 2 turns the source CLI into a publishable product. Extend `main.ts` so the default command still runs checks, while `init hooks`, `init github`, and `init all` generate downstream assets from shipped templates. Add the templates themselves, make overwrite behavior explicit and safe, and update README plus repository-local hook/workflow examples to reflect the npm package story.

Milestone 3 validates and publishes. Run the lint/build/smoke gates, inspect the `npm pack` tarball, publish publicly with the provided `NODE_AUTH_TOKEN`, and verify the registry artifact by invoking the published package. Once the release is confirmed, archive the completed task specs, update `docs/EXECPLAN.md`, `docs/tasks/index.md`, `docs/index.md`, and `AGENTS.md`, then commit and push the final documentation state with `jj`.

## Concrete Steps

Work from the repository root:

    cd /Users/mish/scripts/uat

Milestone 1 baseline:

    npm install
    npm run lint
    npm run smoke:help

Expected result: the linter exits 0 and `tsx main.ts --help` prints the current source CLI help.

Milestone 2 package implementation:

    npm run build
    node dist/main.js --help
    node dist/main.js check --base-url https://example.com --no-external --max-pages 1 --output json
    node dist/main.js init hooks --dry-run
    node dist/main.js init github --dry-run

Expected result: the build exits 0, the compiled CLI help references `uat`, the `check` command runs from `dist/`, and both installer commands describe the files they would write without mutating the repository during dry runs.

Milestone 3 packaging and release:

    npm pack
    npm publish --access public
    npx @nothumanwork/uat@1.0.0 --help

Expected result: `npm pack` writes a tarball containing `dist/`, `README.md`, and template assets; `npm publish` succeeds with the scoped name; the `npx` smoke run resolves from the registry and prints the packaged CLI help.

At the end of each milestone, update this file plus the affected task specs, run the quality gates for that milestone, then commit and push with `jj describe`, `jj bookmark set main`, and `jj git push --bookmark main`.

## Validation and Acceptance

Acceptance requires all of the following:

`npm run lint` passes on the checked-in source tree.

`npm run build` produces a runnable `dist/main.js` CLI artifact.

The compiled CLI supports both the existing crawl behavior and the new installer subcommands. A dry run of each installer shows the exact target files and refuses to overwrite pre-existing files unless an explicit force flag is provided.

`npm pack` includes only the files needed for downstream use: compiled runtime code, packaged templates, and top-level documentation needed by consumers.

`npm publish --access public` succeeds using the provided environment token, and a post-publish registry invocation confirms the package can be executed by downstream consumers.

`README.md`, `docs/index.md`, `docs/tasks/index.md`, `docs/tasks/todo/index.md`, and `AGENTS.md` all describe the shipped command structure and release validation path accurately.

## Idempotence and Recovery

`npm install`, `npm run lint`, `npm run build`, and `npm pack` are safe to re-run. Installer commands must support `--dry-run` so they can be exercised repeatedly without changing the current repository. If an installer writes files incorrectly during development, remove only the generated files and rerun the command after fixing the template or path logic.

If `npm publish` fails before a version is published, fix the cause and retry the same version. If the publish succeeds but a later smoke check fails, the recovery path is a patch release with the next semver version; do not attempt to overwrite a published version. If the registry token is missing or lacks permission, stop at the publish step, record the exact command and error in this file, and do not mark the release task complete.

Use `jj` for version control checkpoints. Because the working copy is always a commit, set the commit description before each push, then advance the `main` bookmark explicitly. If a milestone needs to be rolled back locally, use `jj undo` or `jj op restore <op-id>` rather than destructive Git commands.

## Artifacts and Notes

Pre-release registry availability check:

    $ npm view @nothumanwork/uat version
    npm error code E404
    npm error 404 Not Found - GET https://registry.npmjs.org/@nothumanwork%2fuat - Not found

Toolchain versions used while drafting this plan:

    $ node --version
    v25.2.1

    $ npm --version
    11.6.2

    $ bun --version
    1.3.11

Milestone 1 validation:

    $ npm install
    added 8 packages, changed 3 packages, and audited 13 packages in 7s
    found 0 vulnerabilities

    $ npm run lint
    > @nothumanwork/uat@1.0.0 lint
    > biome check main.ts browser.ts package.json tsconfig.json biome.json
    Checked 5 files in 10ms. No fixes applied.

    $ npm run smoke:help
    > @nothumanwork/uat@1.0.0 smoke:help
    > tsx main.ts --help
    Usage: bun main.ts [options]

## Interfaces and Dependencies

The published package will expose one executable named `uat` through the `bin` map in `package.json`. The default behavior must remain the site checker currently implemented in `main.ts`, and the checker must preserve the existing flag contract for `--base-url`, `--max-pages`, `--concurrency`, `--timeout`, `--no-external`, `--verbose`, `--output`, `--entry-points`, `--exit-on-failure`, and `--browser`.

`browser.ts` remains the Playwright-backed browser engine. `playwright` stays a runtime dependency because browser mode needs Chromium automation at execution time.

The new installer surface must live in the published CLI. It needs explicit commands that write a pre-commit hook to `.git/hooks/pre-commit` and workflow files into `.github/workflows/`. The installers must ship their source assets inside the npm tarball, and they must implement no-overwrite-by-default semantics with an explicit force escape hatch.

The release quality gates for this plan are `npm run lint`, `npm run build`, source or compiled smoke commands, `npm pack`, and `npm publish --access public`.

Change note: replaced the completed stabilization ExecPlan with a release ExecPlan for publishing `@nothumanwork/uat`, then updated milestone 1 with npm-based lint/smoke evidence and archived the completed baseline task.
