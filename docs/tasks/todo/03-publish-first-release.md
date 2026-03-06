# Publish First Release

## Goal

Publish `@nothumanwork/uat@1.0.0` to npm and verify that the registry artifact works exactly as the tarball validation predicted. This task is complete when `npm publish --access public` succeeds, the published package can be executed through `npx`, and the release evidence is recorded in the docs.

## Why This Matters

The package work is only useful if downstream users can actually install and execute the released artifact. Local source verification is necessary but not sufficient; the final proof is a successful publish and a registry-backed smoke run.

## Files In Scope

- `package.json`
- `package-lock.json`
- `README.md`
- `docs/EXECPLAN.md`
- `docs/index.md`
- `docs/tasks/index.md`
- `docs/tasks/todo/index.md`
- `docs/tasks/done/**`
- `AGENTS.md`

## Implementation Notes

Before publishing, validate the tarball with `npm pack` and inspect that it contains the compiled CLI and installer assets. Use the provided `NODE_AUTH_TOKEN` from the environment for auth. If npm returns an auth, permission, or scope-level error, stop immediately, record the exact error in the docs, and report the exact user-run command needed to finish the release manually.

After a successful publish, run a smoke command that resolves from the registry, not from the local working tree. Then move the completed task specs from `docs/tasks/todo/` to `docs/tasks/done/`, update the indexes, and record the shipped version plus verification evidence in the ExecPlan and repo guidance.

## Validation

Run from the repository root:

    npm run lint
    npm run build
    npm pack
    npm publish --access public
    npx @nothumanwork/uat@1.0.0 --help

Success means the tarball is created, the publish succeeds, and the registry-backed help command prints the package CLI usage.

## Completion Notes

- Status: pending
- Blocking dependencies: `02-package-cli-and-installers.md`
