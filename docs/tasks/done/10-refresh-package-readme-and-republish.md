# Refresh Package README And Republish

## Goal

Publish `@nothumanwork/uat@1.0.2` with a package-focused README that removes repo-layout notes from the npm package page while preserving those instructions in `AGENTS.md`.

## Why This Matters

The npm package page should explain how downstream users install and run `uat`, not how contributors navigate the repository. The package already works, so this patch release is about keeping the published documentation aligned with the product surface.

## Files In Scope

- `README.md`
- `AGENTS.md`
- `package.json`
- `package-lock.json`
- `docs/EXECPLAN.md`
- `docs/index.md`
- `docs/tasks/index.md`
- `docs/tasks/todo/index.md`
- `docs/tasks/done/index.md`
- `docs/tasks/done/**`

## Implementation Notes

The package README is now consumer-facing: the repo-layout notes were removed from `README.md`, and the repo-level instruction lives in `AGENTS.md` instead. The package version was bumped to `1.0.2`, the patch release was published, and the registry plus anonymous `npx` checks confirmed the new public `latest` state.

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
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm publish --access public
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm access get status @nothumanwork/uat
    NPM_CONFIG_USERCONFIG="$tmp_npmrc" npm dist-tag ls @nothumanwork/uat
    rm -f "$tmp_npmrc"

    npm view @nothumanwork/uat version
    npm view @nothumanwork/uat versions --json

    tmpdir="$(mktemp -d)"
    cd "$tmpdir"
    npx @nothumanwork/uat@1.0.2 --help

Success means the package builds cleanly, the publish succeeds, the registry reports `1.0.2` as `latest`, and anonymous `npx` execution resolves the new version.

## Completion Notes

- Status: completed on 2026-03-06
- Release state: `npm view @nothumanwork/uat version` returns `1.0.2`, and `npm view @nothumanwork/uat versions --json` returns `["1.0.0", "1.0.1", "1.0.2"]`
- Public-read verification: `npx @nothumanwork/uat@1.0.2 --help` succeeds from a clean temp directory
- Blocking dependencies: the existing public release state recorded in `../done/09-publish-first-release.md`
