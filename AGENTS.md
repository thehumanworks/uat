# Repository Guidance

This repository uses a docs-first workflow layout.

- Start at `docs/index.md` for the documentation map.
- Active task specs live under `docs/tasks/todo/`.
- Completed task specs live under `docs/tasks/done/`.
- `docs/EXECPLAN.md` remains the canonical execution log for long-running work and should stay in sync with the task docs when work is in flight.

When you move or add docs, update `docs/index.md` and `docs/tasks/index.md` in the same change.

For code changes, verify with the smallest relevant command-driven checks first. During the current npm packaging work, keep `docs/EXECPLAN.md` and `docs/tasks/todo/` in sync with each milestone. The release baseline quality gates are:

    npm run lint
    npm run build
    npm run smoke:help

For npm registry auth during release work, use a temporary `NPM_CONFIG_USERCONFIG` populated from `NODE_AUTH_TOKEN` and delete it after the command completes. Do not write npm credentials into repository files.

For compiled CLI smoke tests during release work, prefer a local HTTP fixture over external HTTPS URLs so validation is not gated on the host machine's Node trust store.

Published-package installer assets live in `templates/`, and `main.ts` replaces the `__PACKAGE_*__` and `__PLAYWRIGHT_SPEC__` tokens at install time. Repo-local CI runs `node dist/main.js check`, while the published installers generate `npx --yes @nothumanwork/uat@<version>` workflows and hooks.
