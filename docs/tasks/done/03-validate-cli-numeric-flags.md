# Task 03: Validate Numeric CLI Flags

## Goal

Reject invalid numeric CLI values up front, with clear error messages, instead of allowing hangs or undefined crawl behavior.

## Why This Matters

The current parser accepts `0`, negative numbers, and `NaN` for flags such as `--concurrency`, `--max-pages`, and `--timeout`. The most visible failure is `--concurrency 0`, which deadlocks the semaphore and hangs the process. In CI or hooks, that turns a user error into a stuck job.

## Status

Done on 2026-03-06. Numeric CLI flags now fail fast with explicit validation errors.

## Evidence

- `parseArgs()` uses `parseInt()` without validation.
- `Semaphore.acquire()` cannot make progress when `max === 0`.
- Reproduction from the repo root:

      python3 - <<'PY'
      import subprocess
      cmd = [
          "bun", "main.ts",
          "--base-url", "https://example.com",
          "--no-external",
          "--max-pages", "1",
          "--concurrency", "0",
          "--output", "json",
      ]
      try:
          subprocess.run(cmd, cwd="/Users/mish/scripts/uat", timeout=3, check=False)
          print("unexpected-completion")
      except subprocess.TimeoutExpired:
          print("TIMEOUT")
      PY

  Expected current failure:

      TIMEOUT

## Scope

Primary files:

- `main.ts`
- `README.md` only if usage text needs to clarify minimum values

## Implementation Notes

Add a shared numeric parser/validator for CLI flags. It should:

- Reject missing values after numeric flags.
- Reject non-integer or non-positive values for `--concurrency` and `--max-pages`.
- Reject non-positive values for `--timeout`.
- Emit a direct error message to stderr and exit with code `1`.

Keep the public flag names unchanged. The goal is to harden the existing CLI, not redesign it.

## Verification

Acceptance checks from the repo root:

    bun main.ts --base-url https://example.com --no-external --max-pages 1 --concurrency 0 --output json
    bun main.ts --base-url https://example.com --no-external --max-pages 0 --output json
    bun main.ts --base-url https://example.com --no-external --timeout 0 --output json

Expected behavior after the fix:

- Each command exits quickly with code `1`.
- Each command prints a clear validation error naming the offending flag.
- A normal control run such as `bun main.ts --base-url https://example.com --no-external --max-pages 1 --output json` still succeeds.

## Completion Notes

Verified from the repo root:

    bun main.ts --base-url https://example.com --no-external --max-pages 1 --concurrency 0 --output json
    Error: --concurrency must be a positive integer. Received "0".
    EXIT:1

    bun main.ts --base-url https://example.com --no-external --max-pages 0 --output json
    Error: --max-pages must be a positive integer. Received "0".
    EXIT:1

    bun main.ts --base-url https://example.com --no-external --timeout 0 --output json
    Error: --timeout must be a positive integer. Received "0".
    EXIT:1

Control run still succeeds:

    bun main.ts --base-url https://example.com --no-external --max-pages 1 --output json

    {
      "baseUrl": "https://example.com",
      "pagesChecked": 1,
      "linksChecked": 1,
      "brokenLinks": []
    }
