# Package CLI And Installers

## Goal

Ship a runnable npm artifact that exposes the `uat` executable with both the checker and explicit installer commands. This task is complete when the compiled CLI in `dist/` can run `check`, `init hooks`, `init github`, and `init all`, and the installer commands use packaged assets rather than repository-relative source files.

## Why This Matters

The package would not be useful to downstream projects if it still depended on this repository checkout or on Bun-specific scripts. Publishing without a compiled CLI, packaged templates, and safe installer commands would produce a package that installs but does not deliver the promised automation setup.

## Files Changed

- `main.ts`
- `browser.ts`
- `setup-hooks.sh`
- `hooks/pre-commit`
- `README.md`
- `.github/workflows/uat-link-check.yml`
- `.github/workflows/uat-post-deploy-link-check.yml`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `templates/pre-commit`
- `templates/uat-link-check.yml`
- `templates/uat-post-deploy-link-check.yml`
- `AGENTS.md`

## What Changed

The CLI now exposes a command layer with `check`, `init hooks`, `init github`, and `init all`, while still accepting the historical `uat --base-url ...` form for compatibility. The TypeScript build now emits a runnable `dist/main.js` for Node, and the downstream installer templates are shipped under `templates/`.

Repository-local automation was moved onto the same npm/Node path used for packaging: the source pre-commit hook now runs `tsx main.ts check ...`, and the repository workflows install dependencies, build the package artifact, and execute `node dist/main.js check ...`. The published templates install version-pinned downstream hooks and workflow files that execute `npx --yes @nothumanwork/uat@<version>`.

## Validation

Run from the repository root:

    npm run lint
    npm run build
    npm run smoke:help
    node dist/main.js --help
    node dist/main.js check --base-url http://example.com --no-external --max-pages 1 --output json

Installer validation uses temporary directories so the current checkout is not mutated:

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

Success criteria:

- the build exits 0
- the compiled help references the packaged command structure
- the compiled checker succeeds against an HTTP smoke target
- both installer commands write the expected files into temporary targets

## Completion Notes

- Status: completed on 2026-03-06 15:00Z
- Environment note: Node 25 HTTPS fetches to some public sites fail locally with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, so the compiled smoke check used `http://example.com` rather than `https://example.com`
- Follow-on work: `docs/tasks/todo/03-publish-first-release.md`
