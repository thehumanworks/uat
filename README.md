# uat

`uat` stands for UI Automated Testing. It crawls websites, checks for broken links, and reports browser-visible UI issues.

## Setup

```bash
# 1. Install dependencies
bun install

# 2. (Optional) Install Playwright for browser checks
bunx playwright install --with-deps chromium

# 3. (Optional) Install pre-commit hook
./setup-hooks.sh install
```

Requires [Bun](https://bun.sh). Playwright is only needed for `--browser` mode.

## Documentation Layout

- `docs/index.md` is the repository documentation entrypoint.
- `docs/tasks/todo/` holds active task specs.
- `docs/tasks/done/` archives completed task specs.
- `docs/EXECPLAN.md` remains the living execution log for long-running work.

## Usage

```bash
# HTTP-only check (fast)
bun main.ts --base-url https://yoursite.com

# HTTP + browser check (thorough)
bun main.ts --base-url https://yoursite.com --browser

# Local dev server
bun main.ts --base-url http://localhost:3000 --no-external

# CI mode (exit 1 on failure)
bun main.ts --base-url https://yoursite.com --exit-on-failure
```

`--base-url` is required. You can also set it via the `BASE_URL` env var.

## Configuration reference

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--base-url <url>` | -- | URL to crawl (required, or set `BASE_URL`) |
| `--max-pages <n>` | `300` | Max internal pages to crawl |
| `--concurrency <n>` | `5` | Concurrent requests (browser mode caps at 3) |
| `--timeout <ms>` | `15000` | Per-request timeout in milliseconds |
| `--no-external` | off | Skip checking external links |
| `--verbose` | off | Log each URL as it is checked |
| `--output <format>` | `text` | Output format: `text` or `json` |
| `--entry-points <urls>` | -- | Comma-separated extra paths to seed the crawl |
| `--exit-on-failure` | off | Exit with code 1 on any broken link or browser issue |
| `--browser` | off | Run Playwright browser checks after HTTP crawl |

### Environment variables

| Variable | Context | Default | Description |
|----------|---------|---------|-------------|
| `BASE_URL` | CLI, CI | -- | URL to crawl (same as `--base-url`) |
| `EXIT_ON_FAILURE` | CLI, CI | off | Set `1` or `true` to exit 1 on failure |
| `LINK_CHECK_PORT` | Hook | `3000` | Local dev server port |
| `LINK_CHECK_MAX_PAGES` | Hook | `50` | Max pages to crawl in pre-commit |
| `LINK_CHECK_BROWSER` | Hook | off | Set `1` to enable browser checks in pre-commit |
| `LINK_CHECK_DISABLED` | Hook | off | Set `1` to skip the hook entirely |
| `UAT_BASE_URL` | CI (GitHub secret) | -- | UAT environment URL |
| `PROD_BASE_URL` | CI (GitHub secret) | -- | Production URL |

### npm scripts

| Script | What it does | Requires |
|--------|-------------|----------|
| `bun run check` | HTTP check | `BASE_URL` |
| `bun run check:local` | HTTP check against localhost | `PORT` (default 3000) |
| `bun run check:browser` | HTTP + browser check | `BASE_URL`, Playwright |
| `bun run check:verbose` | HTTP check, verbose output | `BASE_URL` |
| `bun run check:json` | HTTP check, JSON output | `BASE_URL` |

## What it checks

### HTTP checks (default)

Crawls from a base URL, follows all internal links, checks the HTTP status of every discovered URL -- links (`<a href>`), images (`<img src>`, `srcset`), scripts, stylesheets, iframes. Uses HEAD for external URLs, GET for internal. Fast, no browser overhead.

Broken = status >= 400, timeout, or connection error.

### Browser checks (`--browser`)

Launches headless Chromium via Playwright and visits every crawled page. Detects:

- **Console errors** -- `console.error` calls and unhandled JS exceptions
- **Network errors** -- failed XHR/fetch requests (4xx/5xx), skipping static assets already covered by HTTP crawl
- **Broken images** -- `<img>` elements where `naturalWidth` and `naturalHeight` are both 0
- **Dead elements** -- `<a>`, `<button>`, `[role="button"]`, `[onclick]` present in the DOM but with zero bounding-box dimensions

## Reports

**Local runs:** saved to `reports/` with timestamped filenames:

```
reports/2026-03-06_14-30-00-report.txt
reports/2026-03-06_14-30-00-report.json
```

Both files are written on every run. The `reports/` directory is gitignored.

**CI runs:** no local files. A markdown summary table is written to `$GITHUB_STEP_SUMMARY`, visible in the GitHub Actions job summary UI.

## Pre-commit hook

Runs the uat HTTP checker against your local dev server before each commit. Skips cleanly if the dev server is not running.

```bash
./setup-hooks.sh install    # install
./setup-hooks.sh status     # check config
./setup-hooks.sh uninstall  # remove
```

The hook loads `.env` from the project root if it exists. Configure via env vars listed above (`LINK_CHECK_*`).

**Disable:**

```bash
LINK_CHECK_DISABLED=1 git commit -m "..."   # one-time skip
git config hooks.linkcheck false             # permanent disable
./setup-hooks.sh uninstall                   # remove entirely
```

## GitHub Actions

### `uat-link-check.yml`

Triggers on PRs to `main`/`master` and manual dispatch. Set `UAT_BASE_URL` in GitHub Secrets.

| Job | Timeout | What it does |
|-----|---------|--------------|
| Link check | 5 min | HTTP crawl only, exits 1 on failure |
| Browser check | 15 min | HTTP crawl + Playwright, exits 1 on failure |

### `post-deploy-link-check.yml`

Triggers on successful deployments, manual dispatch, and `workflow_call`. Set `PROD_BASE_URL` in GitHub Secrets. Waits 10s after deployment before checking.

| Job | Timeout | What it does |
|-----|---------|--------------|
| Link check | 5 min | HTTP crawl only, exits 1 on failure |
| Browser check | 15 min | HTTP crawl + Playwright, exits 1 on failure |

Both jobs run in parallel in each workflow. Both workflows accept a `base_url` dispatch input to override the secret for manual runs.
