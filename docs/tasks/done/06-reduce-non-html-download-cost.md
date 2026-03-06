# Task 06: Reduce Non-HTML Download Cost

## Goal

Keep internal link verification accurate while avoiding full downloads of large non-HTML resources when only status information is needed.

## Why This Matters

The crawler currently uses `GET` for all internal linked resources and fully drains non-HTML responses. On sites with large PDFs, videos, archives, or media files, that inflates crawl time and bandwidth cost without improving link-status accuracy.

## Status

Done on 2026-03-06. Internal non-page assets are now checked with `HEAD` first and only fall back to `GET` when the server rejects `HEAD`.

## Evidence

- In `crawl()`, unchecked internal URLs are fetched with `GET`.
- In `fetchWithTimeout()`, every non-HTML `GET` response is fully consumed with `await resp.arrayBuffer()`.
- That means any internal asset linked from a page is downloaded in full even if the crawler only needs a success or failure status.

## Scope

Primary files:

- `main.ts`

This is an optimization task. Keep the external behavior of broken-link reporting unchanged.

## Implementation Notes

Possible safe approaches:

- Use `HEAD` for obvious non-page internal assets and fall back to `GET` only when the server rejects `HEAD`.
- Use `GET` with an early-abort strategy once headers confirm a non-HTML asset status.
- Reuse `isLikelyPage()` or a stronger content-type/path heuristic so full-body HTML fetches remain available for crawl expansion.

Whichever approach you choose, preserve accurate status handling for servers that mishandle `HEAD`.

## Verification

Minimum acceptance:

- Control run: `bun main.ts --base-url https://example.com --no-external --max-pages 1 --output json` still succeeds.
- Add a targeted fixture or log-based proof showing that a large internal non-HTML asset no longer needs a full-body download to be reported as healthy.
- Broken internal assets must still appear in `brokenLinks` with correct status and `foundOn` metadata.

## Completion Notes

Chosen strategy: use `HEAD` for internal URLs that are not likely HTML pages, and fall back to `GET` only for `403`/`405` responses.

Verified with the shared local fixture:

    bun main.ts --base-url http://127.0.0.1:63925 --no-external --max-pages 5 --output json

Server log after the fixed run:

    GET /
    HEAD /asset.pdf

The PDF asset is no longer fetched with `GET`, which removes the mandatory full-body download while preserving successful status reporting in the final JSON output.
