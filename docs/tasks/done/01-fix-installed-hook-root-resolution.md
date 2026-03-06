# Task 01: Fix Installed Hook Root Resolution

## Goal

Make the installed Git pre-commit hook invoke the repository's `main.ts` entrypoint correctly after `setup-hooks.sh install` copies `hooks/pre-commit` into `.git/hooks/pre-commit`.

## Status

Completed on 2026-03-06. The installed hook now derives the repository root with `git rev-parse --show-toplevel`, loads `${REPO_ROOT}/.env`, and invokes `${REPO_ROOT}/main.ts` instead of resolving paths relative to `.git/hooks`.

## Why This Matters

This is a workflow-breaking defect. The README promises a working pre-commit guard for local development, but the installed hook currently resolves `SCRIPT_DIR` to the `.git` directory and then tries to run `.git/main.ts`, which does not exist. That means the advertised local automation path fails before it can check anything.

## Evidence

- `setup-hooks.sh` copies `hooks/pre-commit` directly into `.git/hooks/pre-commit`.
- `hooks/pre-commit` computes `SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"`.
- Reproduction from the repo root:

      ./setup-hooks.sh install
      LINK_CHECK_PORT=62390 .git/hooks/pre-commit

  Expected current failure:

      [uat] Checking local site on port 62390 (max 50 pages)...
      error: Module not found "/Users/mish/scripts/uat/.git/main.ts"

## Scope

Primary files:

- `hooks/pre-commit`
- `setup-hooks.sh`
- `README.md` only if the invocation or guarantees need wording updates

Do not change unrelated crawler logic in this task.

## Implementation Notes

Pick one repository-root discovery strategy and document it in the script comments:

- Preferred: have the installed hook derive the worktree root from `git rev-parse --show-toplevel` and build the `main.ts` path from that value.
- Acceptable fallback: have `setup-hooks.sh` install a tiny wrapper that records the repository root at install time and then delegates to the versioned hook in the repository.

Keep `install`, `uninstall`, and `status` behavior intact. If you change the installed artifact shape, make sure `uninstall` still restores any previous hook backup.

## Verification

From the repo root:

    ./setup-hooks.sh install
    LINK_CHECK_PORT=<fixture_port> .git/hooks/pre-commit

Acceptance:

- The hook no longer references `.git/main.ts`.
- The hook runs `main.ts` from the repository root.
- When the fixture site has no broken links, the hook exits `0`.
- `./setup-hooks.sh uninstall` removes the installed hook cleanly or restores the backed-up hook.

## Completion Notes

Verified from the repo root with the real install/run/uninstall flow:

    ./setup-hooks.sh install
    LINK_CHECK_PORT=63923 .git/hooks/pre-commit
    ./setup-hooks.sh uninstall

Observed output after the fix:

    [uat] Checking local site on port 63923 (max 50 pages)...
    uat starting
      Target:      http://localhost:63923
      Max pages:   50
      Concurrency: 10
      External:    no
      Browser:     no

    === Link Check Report ===
    Base URL:       http://localhost:63923
    Pages crawled:  1
    Links checked:  1
    Duration:       0.0s

    No broken links found.
    [uat] All checks OK.

Status and cleanup behavior were also rechecked with:

    ./setup-hooks.sh install
    ./setup-hooks.sh status
    ./setup-hooks.sh uninstall
    ./setup-hooks.sh status

That flow still reported `INSTALLED` after install and `NOT installed` after uninstall.
