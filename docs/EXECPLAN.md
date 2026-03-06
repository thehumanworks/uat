# Stabilize uat

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` was not found in the repository on 2026-03-06, so this document follows the exec-plan skill contract directly.

## Purpose / Big Picture

After this backlog is completed, the repository's automated testing workflow will become trustworthy in the places that matter most: the installed pre-commit hook will invoke the checker from the right location, `--no-external` will not fail builds because of external `srcset` assets, invalid numeric CLI input will fail fast instead of hanging, the crawler will discover valid unquoted links that it currently misses, browser checks will stop flagging intentionally hidden controls as broken UI, and internal asset checks will avoid unnecessary full downloads of large non-HTML files.

The quickest way to observe the desired end state is to run the local reproductions recorded in the task files under `tasks/done/`. Every reproduction in this plan currently demonstrates a real bug or cost center. The work is done when those same commands either fail fast with a helpful validation message or return the expected clean report without regressions.

## Progress

- [x] (2026-03-06 12:29Z) Reviewed every tracked file in the repository, including hidden files, GitHub workflows, lockfiles, and committed sample reports.
- [x] (2026-03-06 12:29Z) Validated the hook path bug, the `--no-external` `srcset` bug, the zero-concurrency deadlock, the unquoted-attribute crawl gap, and the dead-element false-positive behavior with direct command evidence.
- [x] (2026-03-06 12:29Z) Prioritized the backlog and created one task spec per finding, now archived under `tasks/done/`.
- [x] (2026-03-06 12:44Z) Task 01 completed: the installed pre-commit hook now resolves the repository root with `git rev-parse --show-toplevel` and successfully runs `main.ts` from `.git/hooks/pre-commit`.
- [x] (2026-03-06 12:44Z) Tasks 02, 03, 04, and 06 completed together in `main.ts`: `srcset` now honors `--no-external`, numeric flags fail fast, unquoted URLs are discovered, and internal non-page assets are checked with `HEAD` first.
- [x] (2026-03-06 13:01Z) Task 05 completed: hidden-button browser repros are now clean, and a real-site run against `https://littleemperors.com` returned zero browser issues.
- [x] (2026-03-06 12:44Z) [Fix the installed hook path resolution](tasks/done/01-fix-installed-hook-root-resolution.md)
- [x] (2026-03-06 12:44Z) [Honor `--no-external` for `srcset` candidates](tasks/done/02-honor-no-external-for-srcset.md)
- [x] (2026-03-06 12:44Z) [Validate numeric CLI flags before crawling](tasks/done/03-validate-cli-numeric-flags.md)
- [x] (2026-03-06 12:44Z) [Improve HTML link extraction coverage](tasks/done/04-improve-html-link-extraction.md)
- [x] (2026-03-06 13:01Z) [Reduce browser dead-element false positives](tasks/done/05-tune-browser-dead-element-detection.md)
- [x] (2026-03-06 12:44Z) [Avoid full downloads for non-HTML internal assets](tasks/done/06-reduce-non-html-download-cost.md)

## Surprises & Discoveries

- Observation: the installed pre-commit hook resolves `SCRIPT_DIR` relative to `.git/hooks/pre-commit`, so it invokes `bun /path/to/repo/.git/main.ts` instead of the repository entrypoint.
  Evidence: `hooks/pre-commit` computes `SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"`, `setup-hooks.sh` copies that file into `.git/hooks/pre-commit`, and the reproduction command emitted `error: Module not found "/Users/mish/scripts/uat/.git/main.ts"`.

- Observation: `--no-external` is not applied to `srcset` candidates.
  Evidence: `main.ts` adds every parsed `srcset` URL to `toCheck` without an origin check, and `bun main.ts --base-url http://127.0.0.1:62445 --no-external --max-pages 1 --output json` still checked `http://127.0.0.1:65531/missing.png` and reported it broken.

- Observation: zero concurrency deadlocks the crawler instead of returning a validation error.
  Evidence: `parseArgs()` accepts `--concurrency 0` unchanged, `Semaphore.acquire()` never resolves when `max === 0`, and a three-second subprocess timeout was required for `bun main.ts --base-url https://example.com --no-external --max-pages 1 --concurrency 0 --output json`.

- Observation: valid unquoted `href` and `src` attributes are invisible to the crawler.
  Evidence: `extractUrls()` only matches quoted `href=` and `src=` attributes, and the local fixture at `http://127.0.0.1:62390/` contains `<a href=/page2>Page 2</a>` but the checker reported only one checked URL and one crawled page.

- Observation: the browser dead-element heuristic treats any zero-sized interactive element as broken, even when it is intentionally hidden.
  Evidence: `browser.ts` checks only `getBoundingClientRect()` width and height, the local fixture with `<button style="display:none">Hidden</button>` produced a `dead-element` issue, and the committed report `reports/2026-03-06_11-54-35-report.txt` shows the same selector reported across multiple real pages.

- Observation: internal asset verification always downloads full response bodies for non-HTML resources.
  Evidence: `crawl()` uses `GET` for every internal linked resource, and `fetchWithTimeout()` drains the entire `arrayBuffer()` for any non-HTML `GET` response. That guarantees avoidable bandwidth and latency on PDFs, videos, and other large assets.

## Decision Log

- Decision: rank workflow-breaking and contract-breaking bugs ahead of coverage and performance work.
  Rationale: a broken hook and a flag that ignores its documented contract can block developer use and CI immediately, while the later items primarily affect result quality and run cost.
  Date/Author: 2026-03-06 / Codex

- Decision: keep the backlog split into one task file per finding.
  Rationale: the user asked for a durable task-doc layout that survives long-running work beyond a context window, so each task file needs to be independently executable as the source of truth for one change.
  Date/Author: 2026-03-06 / Codex

- Decision: treat `main.ts`, `browser.ts`, `hooks/pre-commit`, and `setup-hooks.sh` as the critical path for the initial repair sequence.
  Rationale: those files control local dev, CI/CD behavior, crawler correctness, and browser-signal quality.
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

All six backlog items are now implemented and verified with command evidence. The local automation path works from the installed Git hook, the main crawler honors its documented flags and discovers the missed URLs, non-HTML assets are checked more cheaply, and browser mode no longer reports intentionally hidden controls as dead elements.

The repository remains small and understandable, and the task specs plus progress log now preserve continuity from the initial review through the completed fixes. The main residual gap is the absence of a formal automated test suite; verification is still command-driven.

## Context and Orientation

The repository is a Bun-based TypeScript CLI for crawling a site and optionally running Playwright browser checks. `main.ts` is the command entrypoint and owns CLI parsing, HTML extraction, HTTP fetching, result aggregation, report generation, and the local-vs-CI output split. `browser.ts` is the browser-only pass that inspects crawled pages for console errors, network failures surfaced through Playwright responses, broken images, and zero-sized interactive elements.

Local workflow integration lives in `setup-hooks.sh` and `hooks/pre-commit`. The installer copies the hook into `.git/hooks`, and the hook tries to call `main.ts` against a local dev server. Remote workflow integration lives in `.github/workflows/uat-link-check.yml` and `.github/workflows/post-deploy-link-check.yml`, both of which run `bun main.ts` in CI. `README.md` documents the intended developer contract. `package.json`, `bun.lock`, and `package-lock.json` define the dependency surface. The `reports/` files are committed run artifacts that show how the current output looks in practice.

The project currently has no formal test suite. Verification therefore relies on command-driven repro fixtures plus the CLI itself. Every task file below includes the exact commands that should become the regression tests or, at minimum, the manual acceptance checks.

## Plan of Work

Start with the local automation breakage. Update `hooks/pre-commit` so an installed hook can find the repository root after `setup-hooks.sh` copies it into `.git/hooks`. Keep the source hook in the repository, but make it compute the project root in a way that still works from the installed location. Once that is fixed, re-run the existing installation flow and make sure the hook executes `main.ts` instead of failing with a missing module path.

Next, fix the documented crawl contract in `main.ts`. The first pass is to make `extractUrls()` treat `srcset` candidates the same way it treats `href` and `src`: respect `checkExternal`, preserve `foundOn`, and avoid creating false failures when `--no-external` is set. In the same file, reject non-positive or non-numeric values for `--concurrency`, `--max-pages`, and `--timeout` before constructing the semaphore or starting network work.

After the contract fixes, broaden extraction accuracy. `extractUrls()` should stop relying on the current narrow regex behavior for valid markup such as unquoted attributes. The safest implementation is to use a real HTML parser or a deliberately broader extraction routine that still normalizes URLs through `resolveUrl()`.

Finish by improving result quality and cost. In `browser.ts`, dead-element detection should exclude intentionally hidden or non-actionable elements so CI only fails on signals a user can act on. In `main.ts`, internal linked assets should be checked without downloading full non-HTML payloads unless that is required for correctness.

## Concrete Steps

Work from the repository root:

    cd /Users/mish/scripts/uat

Use the existing commands as smoke checks before and after each task:

    bun main.ts --help
    bun main.ts --base-url https://example.com --no-external --max-pages 1 --output json

Use the per-task reproductions in `tasks/done/` to confirm each bug before editing and to validate the fix afterward. The highest-priority reproductions already captured during review were:

    ./setup-hooks.sh install
    LINK_CHECK_PORT=62390 .git/hooks/pre-commit

    bun main.ts --base-url http://127.0.0.1:62445 --no-external --max-pages 1 --output json

    bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 5 --output json

    bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 1 --browser --output json

For the zero-concurrency hang, keep a timeout wrapper around the CLI until validation is added so the shell does not wedge a session.

## Validation and Acceptance

The backlog is complete when all six task files can be checked off and the following behavior is true:

The installed hook runs from `.git/hooks/pre-commit` and successfully invokes the repository's `main.ts` when a local server is reachable.

`--no-external` never checks cross-origin resources, including URLs discovered only through `srcset`.

Invalid numeric flags fail fast with a non-zero exit code and a clear error message instead of hanging or silently accepting nonsense input.

The crawler discovers valid links from common HTML forms used by real sites, including unquoted attributes that browsers accept.

Browser checks surface actionable issues while intentionally hidden controls no longer spam reports or fail CI.

Runs against sites with large internal non-HTML assets stay correct without downloading whole files when the status can be determined more cheaply.

## Idempotence and Recovery

Each task should be implemented in a small diff and verified immediately with its paired reproduction. If a hook experiment leaves `.git/hooks/pre-commit` installed, use `./setup-hooks.sh uninstall` before retrying from a clean local workflow state. When using temporary local servers for repros, bind to ephemeral ports and stop the server after validation so later sessions do not inherit stale listeners.

If a task starts to broaden beyond its file scope, stop and record the new dependency in both this plan and the task file before editing. Do not silently merge multiple backlog items into one patch; the task files are meant to preserve continuity across interrupted sessions.

## Artifacts and Notes

Verified installed hook success:

    [uat] Checking local site on port 63923 (max 50 pages)...
    uat starting
      Target:      http://localhost:63923
    ...
    No broken links found.
    [uat] All checks OK.

Verified `--no-external` fix:

    {
      "baseUrl": "http://127.0.0.1:63923",
      "pagesChecked": 2,
      "linksChecked": 3,
      "brokenLinks": []
    }

Verified unquoted-link crawl:

    {
      "baseUrl": "http://127.0.0.1:63923",
      "pagesChecked": 2,
      "linksChecked": 3
    }

Verified numeric validation:

    Error: --concurrency must be a positive integer. Received "0".
    exit:1

Verified dead-element false-positive removal:

    {
      "baseUrl": "http://127.0.0.1:64196",
      "browserIssues": [],
      "browserPagesChecked": 1
    }

Verified real-site browser cleanup:

    {
      "baseUrl": "https://littleemperors.com",
      "pagesChecked": 10,
      "linksChecked": 209,
      "brokenLinks": [],
      "browserIssues": [],
      "browserPagesChecked": 10
    }

Verified lower-cost asset probing:

    GET /
    GET /page2
    HEAD /asset.pdf

## Interfaces and Dependencies

The relevant public surface is the Bun CLI in `main.ts`. The following interfaces and functions are the primary change points:

`Config` in `main.ts` remains the parsed CLI contract and should gain stronger validation semantics without changing the documented flag names.

`extractUrls()` in `main.ts` owns URL discovery and must continue returning `{ toCrawl, toCheck }`, but it needs to apply origin filtering consistently and broaden supported HTML attribute forms.

`fetchWithTimeout()` and the linked-resource branch inside `crawl()` determine how URLs are probed. Any optimization here must preserve accurate broken-link reporting and keep `foundOn` provenance intact.

`BrowserIssue`, `checkPage()`, and `runBrowserChecks()` in `browser.ts` define browser-mode behavior. Heuristic changes should keep the existing issue type schema stable unless a task file explicitly expands it.

`hooks/pre-commit` and `setup-hooks.sh` are the local developer automation interface. Any change there must preserve `install`, `uninstall`, and `status` behavior while making installed hooks self-locating.

Change note: updated on 2026-03-06 after completing all six tasks and re-running the local hook, crawler, and browser verification flows.
