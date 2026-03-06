# Task 02: Honor `--no-external` For `srcset` Candidates

## Goal

Make the crawler respect `--no-external` for every URL discovery path, including `srcset` images and any future responsive-media extraction branches.

## Why This Matters

`--no-external` is part of the documented contract for local development and CI. Right now the crawler still checks cross-origin URLs found in `srcset`, which can produce false failures even when the caller explicitly asked to avoid external traffic.

## Status

Done on 2026-03-06. `srcset` discovery now passes through the same origin-gating path as `href` and `src`.

## Evidence

- `README.md` documents `--no-external` as "Skip checking external links."
- `main.ts` applies origin filtering for `href` and `src`, but the `srcset` branch adds every resolved URL directly to `toCheck`.
- Reproduction from the repo root:

      bun main.ts --base-url http://127.0.0.1:62445 --no-external --max-pages 1 --output json

  Expected current failure:

      {
        "linksChecked": 2,
        "brokenLinks": [
          {
            "url": "http://127.0.0.1:65531/missing.png",
            "status": "error"
          }
        ]
      }

## Scope

Primary files:

- `main.ts`
- Add tests if a new harness is introduced for extractor behavior

Avoid mixing broader parser changes into this task unless they are required to apply the same origin-filtering policy consistently.

## Implementation Notes

Treat `srcset` URLs the same way `href` and `src` URLs are treated:

- Resolve against the page URL.
- If the target is same-origin, add it to `toCheck`.
- If the target is cross-origin, only add it when `checkExternal` is true.
- Preserve `foundOn` provenance so reports remain actionable.

If you touch shared extraction logic, centralize the origin-gating step so this bug cannot reappear in a future attribute branch.

## Verification

Run the current repro fixture before and after the change:

    bun main.ts --base-url http://127.0.0.1:62445 --no-external --max-pages 1 --output json

Acceptance:

- After the fix, `linksChecked` should drop to `1` for the fixture because only the base page remains in scope.
- `brokenLinks` should be empty for the fixture when `--no-external` is set.
- A control run without `--no-external` should still report the external `srcset` URL.

## Completion Notes

Verified from the repo root:

    bun main.ts --base-url http://127.0.0.1:63916 --no-external --max-pages 1 --output json

Result after the fix:

    {
      "baseUrl": "http://127.0.0.1:63916",
      "pagesChecked": 1,
      "linksChecked": 1,
      "brokenLinks": []
    }

Control run without `--no-external` still checks the external `srcset` candidate:

    bun main.ts --base-url http://127.0.0.1:63916 --max-pages 1 --output json

Control result:

    {
      "baseUrl": "http://127.0.0.1:63916",
      "pagesChecked": 1,
      "linksChecked": 2,
      "brokenLinks": [
        {
          "url": "http://127.0.0.1:65531/missing.png",
          "status": "error"
        }
      ]
    }
