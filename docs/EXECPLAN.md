# Publish `@nothumanwork/uat`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` was not found in the repository on 2026-03-06, so this document follows the exec-plan skill contract directly.

## Purpose / Big Picture

After this plan is complete, this repository will ship a public npm package named `@nothumanwork/uat` that can do three concrete things from a downstream project without copying this repo: run the site checker from a CLI, install a managed pre-commit hook into the current Git repository, and install GitHub Actions workflow files into `.github/workflows/` without silently overwriting user-owned files.

The user-visible proof is a full release flow. From a clean checkout, `npm run lint`, `npm run build`, and the relevant smoke tests must pass locally. `npm pack` must produce a tarball containing the compiled CLI and installer templates. `npm publish --access public` must succeed with the scoped package name, and a registry-backed smoke run such as `npx @nothumanwork/uat@1.0.0 --help` must work.

## Progress

- [x] (2026-03-06 13:52Z) Replaced the completed stabilization backlog with a release-focused ExecPlan and created active task specs in `docs/tasks/todo/`.
- [x] (2026-03-06 14:01Z) [Establish the release baseline](tasks/done/07-establish-release-baseline.md): package metadata now targets `@nothumanwork/uat`, TypeScript build configuration exists, `npm run lint` passes, and `npm run smoke:help` prints the source CLI help.
- [x] (2026-03-06 15:00Z) [Package the CLI and installers](tasks/done/08-package-cli-and-installers.md): the compiled CLI now supports `check`, `init hooks`, `init github`, and `init all`, and repository-local docs/hooks/workflows are aligned with npm packaging.
- [ ] Validate the packed tarball with `npm pack` and inspect its contents before publishing.
- [ ] Publish `@nothumanwork/uat@1.0.0` to npm with public access using a temporary npm auth file derived from `NODE_AUTH_TOKEN`.
- [ ] Run a registry-backed smoke check against the published package.
- [ ] Update the remaining docs/task archive entries for the published release, then commit and push the release milestone with `jj`.

## Surprises & Discoveries

- Observation: the repository was not publishable to npm in its starting state because the package had no build artifact, no `bin` entry, and source-oriented automation that assumed `bun main.ts`.
  Evidence: the initial `package.json` had only repo-local scripts, and the original workflows plus hook installer invoked Bun directly from this checkout.

- Observation: TypeScript `moduleResolution: "NodeNext"` required explicit `.js` extensions for the `browser` import paths before `npm run build` would pass.
  Evidence: the first build attempt failed with `TS2835: Relative import paths need explicit file extensions` for both the static and dynamic `./browser` imports in `main.ts`.

- Observation: `uat init github --dry-run --cwd <non-git-dir>` leaked `fatal: not a git repository` to stderr until the internal Git-root probe explicitly suppressed stderr.
  Evidence: the first non-git dry run printed the Git fatal message twice even though the command otherwise completed successfully. After setting `stdio: ["ignore", "pipe", "ignore"]` on the `git rev-parse` calls, the output became clean.

- Observation: Node 25 HTTPS fetches to some public sites fail in this local environment because the local issuer certificate chain is unavailable.
  Evidence: `node -e 'fetch("https://example.com")...'` failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while `node dist/main.js check --base-url http://example.com --no-external --max-pages 1 --output json` succeeded. This is an environment constraint, not a CLI logic failure.

- Observation: the package name `@nothumanwork/uat` was still available on the public npm registry as of 2026-03-06.
  Evidence: `npm view @nothumanwork/uat version` returned `E404 Not Found`.

## Decision Log

- Decision: keep the first published version at `1.0.0`.
  Rationale: the repository already advertised `1.0.0`, the package had never been published under this scope, and there was no registry conflict to force a version bump before the first release.
  Date/Author: 2026-03-06 / Codex

- Decision: expose installers as explicit CLI subcommands rather than implicit side effects of `uat` itself.
  Rationale: running the checker should stay read-only by default, while writing `.git/hooks/pre-commit` or `.github/workflows/*.yml` must be an intentional user action with clear overwrite rules.
  Date/Author: 2026-03-06 / Codex

- Decision: pin the generated downstream hook and workflow commands to the exact published package version for the initial release.
  Rationale: the first release should produce deterministic downstream automation that can be traced back to the exact package contents validated during this session.
  Date/Author: 2026-03-06 / Codex

- Decision: standardize repository-local CI and hook verification on npm plus the built `dist/` artifact instead of Bun.
  Rationale: npm is the package publication path, and the published artifact must be validated in the same toolchain used to build and ship it.
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

Milestone 1 is complete and archived. Milestone 2 is now also complete: `main.ts` exposes the intended command surface, the compiled artifact runs through Node, downstream installer templates are packaged under `templates/`, repository-local workflows build and execute `dist/main.js`, and the source hook uses `tsx` rather than Bun. The final remaining work is release execution: tarball inspection, npm publish, registry-backed smoke validation, and the closing documentation/archive pass.

## Context and Orientation

`main.ts` is the central CLI implementation. It owns top-level command parsing, the crawl loop, result formatting, report persistence, the optional Playwright browser pass loaded from `browser.ts`, and the downstream installer logic that renders files from `templates/`.

Repository-local developer automation lives in `setup-hooks.sh` and `hooks/pre-commit`. The installer copies the source hook into `.git/hooks`, and that hook now runs `tsx main.ts check ...` from the repository root. Repository-local CI examples live in `.github/workflows/uat-link-check.yml` and `.github/workflows/uat-post-deploy-link-check.yml`; both now run `npm ci`, `npm run build`, and `node dist/main.js check ...`.

Downstream package assets live in `templates/pre-commit`, `templates/uat-link-check.yml`, and `templates/uat-post-deploy-link-check.yml`. These are rendered by `main.ts` when a user runs `uat init hooks`, `uat init github`, or `uat init all`.

The docs-first project state lives under `docs/`. This file is the canonical execution log. Active task specs live under `docs/tasks/todo/`, completed task specs under `docs/tasks/done/`, and `docs/tasks/index.md` plus `docs/index.md` must be updated whenever the task layout changes. `AGENTS.md` is repo-wide guidance and must capture high-value release learnings as they are confirmed.

## Plan of Work

Milestone 3 is release-only work. First, validate the package boundary rather than only the repository tree: run `npm pack`, inspect the tarball, and confirm that `dist/`, `templates/`, and `README.md` are included. Then publish with public access using a temporary npm config file so the `NODE_AUTH_TOKEN` never touches repository files. Finally, verify the registry artifact with `npx @nothumanwork/uat@1.0.0 --help` and archive the final task doc state.

## Concrete Steps

Work from the repository root:

    cd /Users/mish/scripts/uat

Milestone 2 validation already completed with:

    npm run lint
    npm run build
    npm run smoke:help
    node dist/main.js --help
    node dist/main.js check --base-url http://example.com --no-external --max-pages 1 --output json

Installer validation used temporary directories so the current checkout was not mutated:

    repo="$(mktemp -d)/repo"
    mkdir -p "$repo"
    cd "$repo"
    git init
    node /Users/mish/scripts/uat/dist/main.js init hooks --dry-run --cwd "$repo"
    node /Users/mish/scripts/uat/dist/main.js init hooks --cwd "$repo"

    project="$(mktemp -d)/project"
    mkdir -p "$project"
    node /Users/mish/scripts/uat/dist/main.js init github --dry-run --cwd "$project"
    node /Users/mish/scripts/uat/dist/main.js init github --cwd "$project"

Milestone 3 publish sequence:

    cd /Users/mish/scripts/uat
    npm pack

    tmp_npmrc="$(mktemp)"
    trap 'rm -f "$tmp_npmrc"' EXIT
    printf '//registry.npmjs.org/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > "$tmp_npmrc"
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm publish --access public

    npx @nothumanwork/uat@1.0.0 --help

Expected result: the tarball contains the compiled runtime and templates, the publish succeeds, and the registry-backed help command resolves from npm.

## Validation and Acceptance

Acceptance requires all of the following:

`npm run lint` passes on the checked-in source tree.

`npm run build` produces a runnable `dist/main.js` CLI artifact.

The compiled CLI supports both the existing crawl behavior and the installer subcommands. Installing hooks and workflows into temporary directories succeeds, and dry runs show the exact file targets without mutating the current checkout.

`npm pack` includes the compiled runtime, packaged templates, and top-level documentation needed by downstream consumers.

`npm publish --access public` succeeds using the provided environment token, and a post-publish registry invocation confirms the package can be executed by downstream consumers.

`README.md`, `docs/index.md`, `docs/tasks/index.md`, `docs/tasks/todo/index.md`, `docs/tasks/done/index.md`, and `AGENTS.md` all describe the shipped command structure and release validation path accurately.

## Idempotence and Recovery

`npm install`, `npm run lint`, `npm run build`, and `npm pack` are safe to re-run. Installer commands support `--dry-run`, and the actual install checks in this plan write only into temporary directories outside the repository tree. If an installer writes files incorrectly during development, delete only the generated files in the temporary project and rerun after fixing the template or path logic.

For npm auth, always use a temporary `NPM_CONFIG_USERCONFIG` file populated from `NODE_AUTH_TOKEN`, then delete it. If `npm publish` fails before a version is published, fix the cause and retry the same version. If the publish succeeds but a later smoke check fails, the recovery path is a patch release with the next semver version; do not attempt to overwrite a published version.

Use `jj` for version control checkpoints. Because the working copy is always a commit, set the commit description before each push, then advance the `main` bookmark explicitly. If a milestone needs to be rolled back locally, use `jj undo` or `jj op restore <op-id>` rather than destructive Git commands.

## Artifacts and Notes

Pre-release registry availability check:

    $ npm view @nothumanwork/uat version
    npm error code E404
    npm error 404 Not Found - GET https://registry.npmjs.org/@nothumanwork%2fuat - Not found

Milestone 2 validation:

    $ npm run lint
    > @nothumanwork/uat@1.0.0 lint
    > biome check main.ts browser.ts package.json tsconfig.json biome.json
    Checked 5 files in 13ms. No fixes applied.

    $ npm run build
    > @nothumanwork/uat@1.0.0 build
    > tsc -p tsconfig.json

    $ node dist/main.js --help
    Usage:
      uat check [options]
      uat init hooks [--dry-run] [--force] [--cwd <path>]
      uat init github [--dry-run] [--force] [--cwd <path>]
      uat init all [--dry-run] [--force] [--cwd <path>]

    $ node dist/main.js check --base-url http://example.com --no-external --max-pages 1 --output json
    {
      "baseUrl": "http://example.com",
      "pagesChecked": 1,
      "linksChecked": 1,
      "brokenLinks": [],
      "durationMs": 225
    }

    $ node -e 'fetch("https://example.com").then((r) => console.log(r.status))'
    TypeError: fetch failed
    [cause]: Error: unable to get local issuer certificate

    $ node dist/main.js init github --dry-run --cwd "$project"
    uat init github dry run
      WRITE GitHub workflow: .../.github/workflows/uat-link-check.yml
      WRITE GitHub workflow: .../.github/workflows/uat-post-deploy-link-check.yml

## Interfaces and Dependencies

The published package exposes one executable named `uat` through the `bin` map in `package.json`. The default behavior remains the site checker implemented in `main.ts`, and the checker preserves the existing flag contract for `--base-url`, `--max-pages`, `--concurrency`, `--timeout`, `--no-external`, `--verbose`, `--output`, `--entry-points`, `--exit-on-failure`, and `--browser`.

`browser.ts` remains the Playwright-backed browser engine. `playwright` stays a runtime dependency because browser mode needs Chromium automation at execution time.

The installer surface lives in the published CLI. It writes a pre-commit hook to `.git/hooks/pre-commit` and workflow files to `.github/workflows/uat-link-check.yml` plus `.github/workflows/uat-post-deploy-link-check.yml`. The installers ship their source assets inside `templates/` and implement no-overwrite-by-default semantics with an explicit `--force` escape hatch.

The release quality gates for this plan are `npm run lint`, `npm run build`, source or compiled smoke commands, `npm pack`, `npm publish --access public`, and a registry-backed `npx` smoke invocation.

Change note: restored the missing ExecPlan file, recorded milestone 2 completion, updated the release validation commands to the current npm/Node workflow, and documented the local Node HTTPS certificate constraint discovered during compiled smoke checks.
