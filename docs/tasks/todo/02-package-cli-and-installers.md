# Package CLI And Installers

## Goal

Ship a runnable npm artifact that exposes the `uat` executable with both the checker and explicit installer commands. This task is complete when the compiled CLI in `dist/` can run `check`, `init hooks`, `init github`, and `init all`, and the installer commands use packaged assets rather than repository-relative source files.

## Why This Matters

The current implementation only works from this repository checkout. Downstream users cannot install a hook or workflow from npm because the assets assume `bun main.ts` exists in the current project. Publishing without fixing that would produce a package that installs but does not deliver the promised automation setup.

## Files In Scope

- `main.ts`
- `browser.ts`
- `setup-hooks.sh`
- `hooks/pre-commit`
- `README.md`
- `.github/workflows/uat-link-check.yml`
- `.github/workflows/post-deploy-link-check.yml`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `templates/**`
- `docs/EXECPLAN.md`
- `docs/index.md`
- `docs/tasks/index.md`
- `docs/tasks/todo/index.md`
- `AGENTS.md`

## Implementation Notes

Keep the existing checker flags stable, but add a command layer so `uat check ...` is explicit and the historical `uat --base-url ...` path still works for compatibility. The installer commands must be opt-in and must refuse to overwrite existing files unless the user passes an explicit force flag.

Repository-local assets and published-package assets are different concerns. If this repository keeps source-oriented hook/workflow examples for dogfooding, package installer templates need to live in a separate shipped directory such as `templates/`. Dry-run support is required for the installer commands so the package can be verified without mutating the current checkout.

## Validation

Run from the repository root:

    npm run lint
    npm run build
    node dist/main.js --help
    node dist/main.js check --base-url https://example.com --no-external --max-pages 1 --output json
    node dist/main.js init hooks --dry-run
    node dist/main.js init github --dry-run

Success means the build exits 0, the compiled help references the packaged command structure, the compiled checker runs, and both installer commands report their planned writes without changing the repository.

## Completion Notes

- Status: pending
- Blocking dependencies: baseline completed in `../done/07-establish-release-baseline.md`
