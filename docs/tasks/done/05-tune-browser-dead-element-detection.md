# Task 05: Tune Browser Dead-Element Detection

## Status

Completed on 2026-03-06. Dead-element checks now skip elements that are intentionally hidden or otherwise non-actionable in the current viewport.

## Goal

Reduce browser-check false positives by only reporting interactive elements that are supposed to be actionable to a user, not elements that are intentionally hidden or out of play.

## Why This Matters

The browser mode is meant to catch actionable UI defects, but the current heuristic flags any interactive element with a zero-sized bounding box. Hidden mobile controls, template elements, and conditionally rendered buttons can therefore fail CI even when the UI is working as designed.

## Evidence

- `browser.ts` marks candidates as dead solely because `rect.width === 0 || rect.height === 0`.
- Reproduction from the repo root:

      bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 1 --browser --output json

  Expected current output includes:

      {
        "type": "dead-element",
        "pageUrl": "http://127.0.0.1:62390",
        "detail": "Element exists in DOM but has zero dimensions: \"Hidden\"",
        "element": "button"
      }

- The committed sample report `reports/2026-03-06_11-54-35-report.txt` repeats the same zero-sized button on many pages, which is consistent with a noisy heuristic rather than eight distinct user-visible failures.

## Scope

Primary files:

- `browser.ts`
- `README.md` only if the browser-check description needs clarification

## Implementation Notes

Keep the intent of the check, but tighten its eligibility rules. Good filters include:

- Ignore elements with `display:none`, `visibility:hidden`, `hidden`, or `aria-hidden="true"`.
- Ignore elements detached from layout or explicitly disabled from user interaction.
- Prefer reporting only elements that are expected to be visible and clickable in the current viewport.

If the final heuristic changes the issue semantics materially, document the new rule in the README.

## Verification

Acceptance checks:

    bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 1 --browser --output json

After the fix:

- The hidden button fixture should not produce a `dead-element`.
- Existing console-error and broken-image detection should remain intact.
- Run at least one real-site browser check to confirm the repeated noisy selector either disappears or becomes a smaller, defensible set of issues.

## Completion Notes

Verified from the repo root against a hidden-button fixture:

    bun main.ts --base-url http://127.0.0.1:64196 --no-external --max-pages 1 --browser --output json

Result after the fix:

    {
      "baseUrl": "http://127.0.0.1:64196",
      "pagesChecked": 1,
      "linksChecked": 2,
      "brokenLinks": [],
      "browserIssues": [],
      "browserPagesChecked": 1
    }

Real-site smoke check:

    bun main.ts --base-url https://littleemperors.com --no-external --max-pages 10 --browser --output json

Real-site result:

    {
      "baseUrl": "https://littleemperors.com",
      "pagesChecked": 10,
      "linksChecked": 209,
      "brokenLinks": [],
      "browserIssues": [],
      "browserPagesChecked": 10
    }

The earlier repeated dead-element selector is gone from the browser issue output. The run did emit one navigation timeout on `https://littleemperors.com/independent-travel-agent`, but it did not create a dead-element issue or change the browser issue schema.
