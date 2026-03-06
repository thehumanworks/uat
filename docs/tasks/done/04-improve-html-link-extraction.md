# Task 04: Improve HTML Link Extraction Coverage

## Goal

Expand crawler URL discovery so it captures valid markup patterns that browsers accept today, starting with unquoted `href` and `src` attributes.

## Why This Matters

The crawler currently misses real links because its regex only recognizes quoted attribute values. That creates false negatives: pages appear clean even though reachable internal pages or assets were never checked.

## Status

Done on 2026-03-06. URL extraction now accepts valid unquoted `href` and `src` attribute values.

## Evidence

- `main.ts` uses `/(?:href|src)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')/gi`, which requires quotes.
- The review fixture served this HTML:

      <!doctype html><html><body><a href=/page2>Page 2</a><button style="display:none">Hidden</button>...</body></html>

- Reproduction from the repo root:

      bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 5 --output json

  Expected current failure:

      {
        "pagesChecked": 1,
        "linksChecked": 1,
        "brokenLinks": []
      }

## Scope

Primary files:

- `main.ts`
- Add a focused parser or extraction helper if that yields more reliable behavior

Do not bundle browser-heuristic changes into this task.

## Implementation Notes

Prefer reliability over clever regex expansion. The safest direction is to use a lightweight HTML parser and query `href`, `src`, and `srcset` attributes explicitly. If you keep a regex-based approach, it must at least support quoted and unquoted attribute values without introducing duplicate URLs or malformed parsing.

Any new extraction path must still:

- Normalize through `resolveUrl()`.
- Preserve same-origin vs cross-origin behavior.
- Keep `toCrawl` limited to likely HTML pages.
- Record `foundOn` sources for reporting.

## Verification

Use the existing fixture:

    bun main.ts --base-url http://127.0.0.1:62390 --no-external --max-pages 5 --output json

Acceptance:

- The checker should crawl `/page2`.
- `pagesChecked` should become `2`.
- `linksChecked` should be greater than `1`.
- Existing quoted-attribute behavior should remain correct on a control page.

## Completion Notes

Verified from the repo root:

    bun main.ts --base-url http://127.0.0.1:63907 --no-external --max-pages 5 --output json

Result after the fix:

    {
      "baseUrl": "http://127.0.0.1:63907",
      "pagesChecked": 2,
      "linksChecked": 2,
      "brokenLinks": []
    }

The fixture page still contains the unquoted link form:

    <!doctype html><html><body><a href=/page2>Page 2</a>...</body></html>

The crawler now reaches `/page2`, so the prior false negative is closed.
