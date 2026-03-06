# uat

`uat` stands for UI Automated Testing. It crawls websites, checks for broken links, and reports browser-visible UI issues.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Install Playwright for browser checks
npx playwright install --with-deps chromium

# 3. (Optional) Install the repo-local pre-commit hook while developing this package
./setup-hooks.sh install
```

Requires Node 20+. Playwright is only needed for `--browser` mode.

## Package Usage

Run the published CLI without cloning this repository:

```bash
# HTTP-only check
npx @nothumanwork/uat check --base-url https://yoursite.com

# HTTP + browser check
npx @nothumanwork/uat check --base-url https://yoursite.com --browser

# Install the managed pre-commit hook into the current Git repo
npx @nothumanwork/uat init hooks

# Install the managed GitHub Actions workflows into the current project
npx @nothumanwork/uat init github
```

The installer commands refuse to overwrite files with different content unless you pass `--force`. Use `--dry-run` to preview the writes.

## Documentation Layout

- `docs/index.md` is the repository documentation entrypoint.
- `docs/tasks/todo/` holds active task specs.
- `docs/tasks/done/` archives completed task specs.
- `docs/EXECPLAN.md` remains the living execution log for long-running work.

## Usage

```bash
# HTTP-only check (fast)
uat check --base-url https://yoursite.com

# HTTP + browser check (thorough)
uat check --base-url https://yoursite.com --browser

# Local dev server
uat check --base-url http://localhost:3000 --no-external

# CI mode (exit 1 on failure)
uat check --base-url https://yoursite.com --exit-on-failure
```

`--base-url` is required. You can also set it via the `BASE_URL` env var. For backwards compatibility, `uat --base-url ...` is treated the same as `uat check --base-url ...`.

## Commands

### `uat check`

Runs the crawler and optional browser checks.

### `uat init hooks`

Installs a managed pre-commit hook into the current Git repository. The generated hook prefers a locally installed `uat` binary from `node_modules/.bin/uat` and falls back to `npx --yes @nothumanwork/uat@<version>`.

### `uat init github`

Installs `.github/workflows/uat-link-check.yml` and `.github/workflows/uat-post-deploy-link-check.yml` into the current project.

### `uat init all`

Installs both the pre-commit hook and the GitHub workflows in one command.

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
| `init hooks --dry-run` | off | Preview the generated pre-commit hook without writing it |
| `init hooks --force` | off | Replace an existing conflicting pre-commit hook |
| `init github --dry-run` | off | Preview the generated workflow files without writing them |
| `init github --force` | off | Replace existing conflicting workflow files |
| `init all --cwd <path>` | current directory | Install into a specific project root |

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
| `npm run check` | HTTP check | `BASE_URL` |
| `npm run check:local` | HTTP check against localhost | `PORT` (default 3000) |
| `npm run check:browser` | HTTP + browser check | `BASE_URL`, Playwright |
| `npm run check:verbose` | HTTP check, verbose output | `BASE_URL` |
| `npm run check:json` | HTTP check, JSON output | `BASE_URL` |
| `npm run build` | Compile the publishable CLI into `dist/` | TypeScript |
| `npm run lint` | Lint source and package metadata | Biome |
| `npm run smoke:help` | Print the source CLI help via `tsx` | `tsx` |
| `npm run smoke:compiled` | Print the compiled CLI help via `node dist/main.js` | `dist/` |

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

There are two supported hook flows:

- Repository development: `./setup-hooks.sh install` installs the source-repo hook from this checkout.
- Downstream project setup: `npx @nothumanwork/uat init hooks` installs the packaged hook into the target repo.

Both hook variants run the uat HTTP checker against your local dev server before each commit and skip cleanly if the dev server is not running.

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
| Link check | 5 min | `node dist/main.js check`, exits 1 on failure |
| Browser check | 15 min | `node dist/main.js check --browser`, exits 1 on failure |

### `uat-post-deploy-link-check.yml`

Triggers on successful deployments, manual dispatch, and `workflow_call`. Set `PROD_BASE_URL` in GitHub Secrets. Waits 10s after deployment before checking.

| Job | Timeout | What it does |
|-----|---------|--------------|
| Link check | 5 min | `node dist/main.js check`, exits 1 on failure |
| Browser check | 15 min | `node dist/main.js check --browser`, exits 1 on failure |

The packaged installer writes workflow files with the same names into downstream projects, but they execute the published package through `npx --yes @nothumanwork/uat@<version>` instead of relying on a repository checkout.

Both jobs run in parallel in each workflow. Both workflows accept a `base_url` dispatch input to override the secret for manual runs.
