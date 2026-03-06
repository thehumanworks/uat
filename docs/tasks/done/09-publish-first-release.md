# Publish First Release

## Goal

Publish and verify the first public npm release of `@nothumanwork/uat`. This task is complete when the published package is publicly readable through `npx`, the registry metadata confirms the expected visibility, and the release evidence is recorded in the docs.

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

The repository version is `1.0.1`, and registry verification now shows `1.0.1` as the public `latest` tag with `1.0.0` still available in the release history. The closeout work for this task was to verify the public read path from a clean temp directory, confirm the visibility metadata, archive the task under `docs/tasks/done/`, and update the docs-first indexes plus ExecPlan to reflect that there are no active tasks left.

## Validation

Run from the repository root:

    npm run lint
    npm run build
    npm run smoke:help
    npm run smoke:compiled
    npm pack --json

    tmp_npmrc="$(mktemp)"
    chmod 600 "$tmp_npmrc"
    printf '//registry.npmjs.org/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > "$tmp_npmrc"
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm access get status @nothumanwork/uat
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm dist-tag ls @nothumanwork/uat
    rm -f "$tmp_npmrc"

    tmpdir="$(mktemp -d)"
    cd "$tmpdir"
    npx @nothumanwork/uat@1.0.1 --help
    npx @nothumanwork/uat@1.0.0 --help

Success means the source quality gates pass, the package tarball builds, the authenticated metadata checks show `public` plus `latest: 1.0.1`, and the anonymous registry-backed help commands print the package CLI usage.

## Completion Notes

- Status: completed on 2026-03-06
- Release state: `npm view @nothumanwork/uat version` returns `1.0.1`, and `npm view @nothumanwork/uat versions --json` returns `["1.0.0", "1.0.1"]`
- Public-read verification: `npx @nothumanwork/uat@1.0.1 --help` and `npx @nothumanwork/uat@1.0.0 --help` both succeed from a clean temp directory
- Blocking dependencies: packaging completed in `../done/08-package-cli-and-installers.md`
