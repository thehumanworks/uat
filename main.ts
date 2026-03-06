#!/usr/bin/env node

/**
 * uat (UI Automated Testing) — crawls from a base URL, follows internal links,
 * and reports broken links (404s, 5xx, timeouts).
 *
 * Usage:
 *   uat check [options]
 *
 * Options:
 *   --base-url <url>      Base URL to crawl (required, or set BASE_URL env var)
 *   --max-pages <n>       Max internal pages to crawl (default: 300)
 *   --concurrency <n>     Max concurrent requests (default: 5)
 *   --timeout <ms>        Per-request timeout in ms (default: 15000)
 *   --no-external         Skip checking external links
 *   --verbose             Log each URL as it's checked
 *   --output <format>     Output format: text | json (default: text)
 *   --entry-points <urls> Comma-separated extra paths to seed the crawl
 *
 * Reports are saved automatically:
 *   - Local:  reports/<timestamp>-report.{txt,json}
 *   - CI:     logged to worker output + $GITHUB_STEP_SUMMARY
 */

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserCheckResult, BrowserIssue } from "./browser.js";

// ── Types ───────────────────────────────────────────────────────────

interface Config {
  baseUrl: string;
  maxPages: number;
  concurrency: number;
  timeout: number;
  checkExternal: boolean;
  verbose: boolean;
  outputFormat: "text" | "json";
  entryPoints: string[];
  exitOnFailure: boolean;
  browser: boolean;
}

type InitTarget = "hooks" | "github" | "all";

interface InitConfig {
  cwd: string;
  dryRun: boolean;
  force: boolean;
  target: InitTarget;
}

type Command =
  | { kind: "check"; args: string[] }
  | { kind: "init"; config: InitConfig };

interface BrokenLink {
  url: string;
  status: number | "timeout" | "error";
  statusText: string;
  foundOn: string[];
}

interface CrawlResult {
  baseUrl: string;
  pagesChecked: number;
  linksChecked: number;
  brokenLinks: BrokenLink[];
  crawledPages: string[];
  browserIssues?: BrowserIssue[];
  browserPagesChecked?: number;
  durationMs: number;
}

interface PackageMetadata {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

interface PlannedWrite {
  executable?: boolean;
  label: string;
  path: string;
  content: string;
}

// ── ANSI helpers ────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY;
const c = {
  red: (s: string) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string) => (isTTY ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s: string) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s),
};

// ── CLI arg parsing ─────────────────────────────────────────────────

function exitWithCliError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value == null || value.startsWith("--")) {
    exitWithCliError(`${flag} requires a value.`);
  }
  return value;
}

function printRootHelp(): void {
  console.log(
    [
      "Usage:",
      "  uat check [options]",
      "  uat init hooks [--dry-run] [--force] [--cwd <path>]",
      "  uat init github [--dry-run] [--force] [--cwd <path>]",
      "  uat init all [--dry-run] [--force] [--cwd <path>]",
      "",
      "Commands:",
      "  check        Crawl a site and report broken links or browser-visible issues",
      "  init hooks   Install the managed pre-commit hook into the target Git repo",
      "  init github  Install managed GitHub Actions workflow files",
      "  init all     Install both the hook and workflow files",
      "",
      "Compatibility:",
      "  `uat --base-url https://example.com` still works and is treated as `uat check ...`.",
      "",
      "Run `uat check --help` for the checker flags.",
    ].join("\n"),
  );
}

function printInitHelp(target: InitTarget): void {
  console.log(
    [
      `Usage: uat init ${target} [--dry-run] [--force] [--cwd <path>]`,
      "",
      "Options:",
      "  --dry-run   Print the files that would be written without changing anything",
      "  --force     Overwrite managed files when the existing content differs",
      "  --cwd       Project root to install into (defaults to the current directory)",
    ].join("\n"),
  );
}

function parseInitArgs(target: InitTarget, args: string[]): InitConfig {
  const config: InitConfig = {
    cwd: process.cwd(),
    dryRun: false,
    force: false,
    target,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--cwd":
        config.cwd = resolve(readFlagValue(args, i, "--cwd"));
        i++;
        break;
      case "--dry-run":
        config.dryRun = true;
        break;
      case "--force":
        config.force = true;
        break;
      case "--help":
        printInitHelp(target);
        process.exit(0);
        return config;
      default:
        exitWithCliError(
          `Unknown option for \`uat init ${target}\`: ${args[i]}.`,
        );
    }
  }

  return config;
}

function parseCommand(args: string[]): Command {
  const [first, second, ...rest] = args;

  if (first == null) {
    printRootHelp();
    process.exit(0);
  }

  if (first === "--help" || first === "help") {
    printRootHelp();
    process.exit(0);
  }

  if (first === "check") {
    return { kind: "check", args: args.slice(1) };
  }

  if (first === "init") {
    if (second == null || !["hooks", "github", "all"].includes(second)) {
      exitWithCliError(
        "Usage: uat init <hooks|github|all> [--dry-run] [--force] [--cwd <path>].",
      );
    }
    return {
      kind: "init",
      config: parseInitArgs(second as InitTarget, rest),
    };
  }

  if (first.startsWith("--")) {
    return { kind: "check", args };
  }

  exitWithCliError(`Unknown command: ${first}. Run \`uat --help\`.`);
}

function parseCheckArgs(args: string[]): Config {
  const config: Config = {
    baseUrl: process.env.BASE_URL ?? "",
    maxPages: 300,
    concurrency: 5,
    timeout: 15_000,
    checkExternal: true,
    verbose: false,
    outputFormat: "text",
    entryPoints: [],
    exitOnFailure:
      process.env.EXIT_ON_FAILURE === "1" ||
      process.env.EXIT_ON_FAILURE === "true",
    browser: false,
  };

  const parsePositiveIntegerFlag = (index: number, flag: string): number => {
    const raw = readFlagValue(args, index, flag);
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      exitWithCliError(
        `${flag} must be a positive integer. Received "${raw}".`,
      );
    }
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--base-url":
        config.baseUrl = readFlagValue(args, i, "--base-url");
        i++;
        break;
      case "--max-pages":
        config.maxPages = parsePositiveIntegerFlag(i, "--max-pages");
        i++;
        break;
      case "--concurrency":
        config.concurrency = parsePositiveIntegerFlag(i, "--concurrency");
        i++;
        break;
      case "--timeout":
        config.timeout = parsePositiveIntegerFlag(i, "--timeout");
        i++;
        break;
      case "--no-external":
        config.checkExternal = false;
        break;
      case "--verbose":
        config.verbose = true;
        break;
      case "--output":
        config.outputFormat = readFlagValue(args, i, "--output") as
          | "text"
          | "json";
        i++;
        break;
      case "--entry-points":
        config.entryPoints = readFlagValue(args, i, "--entry-points")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        i++;
        break;
      case "--exit-on-failure":
        config.exitOnFailure = true;
        break;
      case "--browser":
        config.browser = true;
        break;
      case "--help":
        console.log(
          [
            "Usage: uat check [options]",
            "",
            "Options:",
            "  --base-url <url>      Base URL to crawl (required, or set BASE_URL env var)",
            "  --max-pages <n>       Max internal pages to crawl (default: 300)",
            "  --concurrency <n>     Max concurrent requests (default: 5)",
            "  --timeout <ms>        Per-request timeout in ms (default: 15000)",
            "  --no-external         Skip checking external links",
            "  --verbose             Log each URL as it's checked",
            "  --output <format>     Output format: text | json (default: text)",
            "  --entry-points <urls> Comma-separated extra paths to seed the crawl",
            "  --exit-on-failure     Exit with code 1 if broken links found (env: EXIT_ON_FAILURE=1)",
            "  --browser             Run Playwright browser checks (console errors, broken images, dead UI)",
            "",
            "Compatibility:",
            "  `uat --base-url https://example.com` is treated the same as `uat check --base-url https://example.com`.",
          ].join("\n"),
        );
        process.exit(0);
    }
  }

  if (!config.baseUrl) {
    exitWithCliError("--base-url is required (or set BASE_URL env var).");
  }

  config.baseUrl = config.baseUrl.replace(/\/+$/, "");
  return config;
}

// ── Concurrency limiter ─────────────────────────────────────────────

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

// ── URL utilities ───────────────────────────────────────────────────

const SKIP_PROTOCOLS = new Set([
  "mailto:",
  "tel:",
  "javascript:",
  "data:",
  "blob:",
  "ftp:",
]);

function resolveUrl(raw: string, base: URL): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  for (const proto of SKIP_PROTOCOLS) {
    if (trimmed.toLowerCase().startsWith(proto)) return null;
  }

  try {
    const resolved = new URL(trimmed, base);
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

function isSameOrigin(url: string, base: URL): boolean {
  try {
    return new URL(url).origin === base.origin;
  } catch {
    return false;
  }
}

function isLikelyPage(url: string): boolean {
  const { pathname } = new URL(url);
  // Skip obvious non-page resources
  if (
    /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|ttf|eot|pdf|zip|mp4|mp3|webm)$/i.test(
      pathname,
    )
  ) {
    return false;
  }
  return true;
}

// ── HTML link extraction ────────────────────────────────────────────

function extractUrls(
  html: string,
  pageUrl: string,
  baseOrigin: URL,
  checkExternal: boolean,
): { toCrawl: string[]; toCheck: string[] } {
  const toCrawl = new Set<string>();
  const toCheck = new Set<string>();
  const pageBase = new URL(pageUrl);

  const addDiscoveredUrl = (raw: string, allowCrawl: boolean) => {
    const resolved = resolveUrl(raw, pageBase);
    if (!resolved) return;

    const sameOrigin = isSameOrigin(resolved, baseOrigin);

    if (sameOrigin) {
      toCheck.add(resolved);
      if (allowCrawl && isLikelyPage(resolved)) {
        toCrawl.add(resolved);
      }
      return;
    }

    if (checkExternal) {
      toCheck.add(resolved);
    }
  };

  // href= and src= attributes (covers <a>, <link>, <img>, <script>, <iframe>, <source>, <video>, <audio>)
  const attrRegex =
    /(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (
    let match = attrRegex.exec(html);
    match !== null;
    match = attrRegex.exec(html)
  ) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (!raw) continue;
    addDiscoveredUrl(raw, true);
  }

  // Also check srcset (responsive images)
  const srcsetRegex = /srcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (
    let match = srcsetRegex.exec(html);
    match !== null;
    match = srcsetRegex.exec(html)
  ) {
    const srcset = match[1] ?? match[2] ?? match[3];
    if (!srcset) continue;
    // srcset format: "url 1x, url 2x" or "url 100w, url 200w"
    for (const entry of srcset.split(",")) {
      const url = entry.trim().split(/\s+/)[0];
      if (!url) continue;
      addDiscoveredUrl(url, false);
    }
  }

  return { toCrawl: [...toCrawl], toCheck: [...toCheck] };
}

function trackLinkSource(
  linkSources: Map<string, Set<string>>,
  url: string,
  pageUrl: string,
): void {
  let sources = linkSources.get(url);
  if (sources == null) {
    sources = new Set<string>();
    linkSources.set(url, sources);
  }
  sources.add(pageUrl);
}

// ── Fetcher with timeout ────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeout: number,
  method: "GET" | "HEAD" = "GET",
  readBody = method === "GET",
): Promise<{ status: number; statusText: string; body: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "LinkChecker/1.0 (site-health-monitor; +https://github.com)",
        Accept: method === "GET" ? "text/html,*/*" : "*/*",
      },
    });

    let body: string | null = null;
    if (method === "GET" && readBody) {
      const contentType = resp.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        body = await resp.text();
      } else {
        // Drain the response body
        await resp.arrayBuffer();
      }
    } else if (method === "GET") {
      await resp.body?.cancel();
    }

    return { status: resp.status, statusText: resp.statusText, body };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { status: 0, statusText: "timeout", body: null };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { status: 0, statusText: message, body: null };
  } finally {
    clearTimeout(timer);
  }
}

// ── Progress display ────────────────────────────────────────────────

function printProgress(
  crawled: number,
  queued: number,
  checked: number,
  broken: number,
): void {
  if (!isTTY) return;
  process.stdout.write(
    `\r${c.cyan("crawled")} ${crawled}/${queued} pages | ${c.cyan("checked")} ${checked} links | ${broken > 0 ? c.red(`${broken} broken`) : c.green("0 broken")}   `,
  );
}

// ── Main crawler ────────────────────────────────────────────────────

async function crawl(config: Config, quiet = false): Promise<CrawlResult> {
  const startTime = Date.now();
  const baseOrigin = new URL(config.baseUrl);

  // Track state
  const crawled = new Set<string>(); // pages we've fetched & parsed
  const checked = new Map<
    string,
    { status: number | "timeout" | "error"; statusText: string }
  >(); // all URLs we've status-checked
  const linkSources = new Map<string, Set<string>>(); // url -> set of pages it was found on
  const crawlQueue: string[] = [config.baseUrl];

  // Add entry points
  for (const ep of config.entryPoints) {
    const resolved = ep.startsWith("http")
      ? ep
      : `${config.baseUrl}${ep.startsWith("/") ? ep : `/${ep}`}`;
    if (!crawlQueue.includes(resolved)) {
      crawlQueue.push(resolved);
    }
  }

  const sem = new Semaphore(config.concurrency);
  let pagesProcessed = 0;

  // Process crawl queue
  while (crawlQueue.length > 0) {
    // Grab a batch from the queue
    const batch = crawlQueue.splice(0, config.concurrency);
    const tasks = batch.map(async (pageUrl) => {
      if (crawled.has(pageUrl) || crawled.size >= config.maxPages) return;
      crawled.add(pageUrl);

      await sem.acquire();
      try {
        const result = await fetchWithTimeout(pageUrl, config.timeout, "GET");
        pagesProcessed++;

        // Record this page's own status
        const statusKey: number | "timeout" | "error" =
          result.status === 0
            ? result.statusText === "timeout"
              ? "timeout"
              : "error"
            : result.status;
        checked.set(pageUrl, {
          status: statusKey,
          statusText: result.statusText,
        });

        if (config.verbose && !quiet) {
          const icon =
            result.status >= 200 && result.status < 400
              ? c.green("OK")
              : c.red(`${result.status}`);
          console.log(`  ${icon} ${pageUrl}`);
        }

        if (!quiet)
          printProgress(
            pagesProcessed,
            crawled.size + crawlQueue.length,
            checked.size,
            countBroken(checked),
          );

        // Parse HTML for links
        if (result.body) {
          const { toCrawl, toCheck } = extractUrls(
            result.body,
            pageUrl,
            baseOrigin,
            config.checkExternal,
          );

          // Queue new internal pages for crawling
          for (const url of toCrawl) {
            if (
              !crawled.has(url) &&
              crawled.size + crawlQueue.length < config.maxPages
            ) {
              crawlQueue.push(url);
            }
            trackLinkSource(linkSources, url, pageUrl);
          }

          // Track all links for checking
          for (const url of toCheck) {
            trackLinkSource(linkSources, url, pageUrl);
          }
        }
      } finally {
        sem.release();
      }
    });

    await Promise.all(tasks);
  }

  // Now check all discovered links that haven't been checked yet
  const unchecked = [...linkSources.keys()].filter((url) => !checked.has(url));

  if (unchecked.length > 0 && config.verbose && !quiet) {
    console.log(
      `\n${c.cyan("Checking")} ${unchecked.length} additional linked resources...`,
    );
  }

  // Check unchecked URLs. Only fetch bodies for likely same-origin pages.
  const checkBatch = async (urls: string[]) => {
    const tasks = urls.map(async (url) => {
      await sem.acquire();
      try {
        const isInternal = isSameOrigin(url, baseOrigin);
        const shouldFetchBody = isInternal && isLikelyPage(url);
        let result = await fetchWithTimeout(
          url,
          config.timeout,
          shouldFetchBody ? "GET" : "HEAD",
          shouldFetchBody,
        );

        // Some servers reject HEAD — retry with GET if we get 405 or 403
        if (
          !shouldFetchBody &&
          (result.status === 405 || result.status === 403)
        ) {
          result = await fetchWithTimeout(url, config.timeout, "GET", false);
        }

        const statusKey: number | "timeout" | "error" =
          result.status === 0
            ? result.statusText === "timeout"
              ? "timeout"
              : "error"
            : result.status;
        checked.set(url, { status: statusKey, statusText: result.statusText });

        if (config.verbose && !quiet) {
          const icon =
            result.status >= 200 && result.status < 400
              ? c.green("OK")
              : c.red(`${result.status}`);
          console.log(`  ${icon} ${url}`);
        }

        if (!quiet)
          printProgress(
            pagesProcessed,
            crawled.size,
            checked.size,
            countBroken(checked),
          );
      } finally {
        sem.release();
      }
    });

    await Promise.all(tasks);
  };

  // Process in batches to avoid overwhelming the event loop
  for (let i = 0; i < unchecked.length; i += config.concurrency * 2) {
    await checkBatch(unchecked.slice(i, i + config.concurrency * 2));
  }

  if (isTTY && !quiet) process.stdout.write("\n");

  // Collect broken links
  const brokenLinks: BrokenLink[] = [];
  for (const [url, result] of checked) {
    const isBroken =
      result.status === "timeout" ||
      result.status === "error" ||
      (typeof result.status === "number" &&
        (result.status >= 400 || result.status === 0));

    if (isBroken) {
      brokenLinks.push({
        url,
        status: result.status,
        statusText: result.statusText,
        foundOn: [...(linkSources.get(url) ?? [])],
      });
    }
  }

  // Sort: 404s first, then by status
  brokenLinks.sort((a, b) => {
    const sa = typeof a.status === "number" ? a.status : 999;
    const sb = typeof b.status === "number" ? b.status : 999;
    if (sa === 404 && sb !== 404) return -1;
    if (sb === 404 && sa !== 404) return 1;
    return sa - sb;
  });

  return {
    baseUrl: config.baseUrl,
    pagesChecked: crawled.size,
    linksChecked: checked.size,
    brokenLinks,
    crawledPages: [...crawled],
    durationMs: Date.now() - startTime,
  };
}

function countBroken(
  checked: Map<
    string,
    { status: number | "timeout" | "error"; statusText: string }
  >,
): number {
  let count = 0;
  for (const result of checked.values()) {
    if (
      result.status === "timeout" ||
      result.status === "error" ||
      (typeof result.status === "number" &&
        (result.status >= 400 || result.status === 0))
    ) {
      count++;
    }
  }
  return count;
}

function resolvePackageRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [currentDir, resolve(currentDir, "..")];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to locate the package root from the current entrypoint.",
  );
}

function readPackageMetadata(): PackageMetadata {
  const metadataPath = join(resolvePackageRoot(), "package.json");
  return JSON.parse(readFileSync(metadataPath, "utf-8")) as PackageMetadata;
}

function exactVersion(versionRange: string | undefined): string {
  if (!versionRange) return "latest";
  return versionRange.replace(/^[^\d]*/, "");
}

function renderTemplate(templateName: string): string {
  const packageRoot = resolvePackageRoot();
  const metadata = readPackageMetadata();
  const templatePath = join(packageRoot, "templates", templateName);
  const packageSpec = `${metadata.name}@${metadata.version}`;
  const playwrightSpec = `playwright@${exactVersion(metadata.dependencies?.playwright)}`;

  const replacements: Record<string, string> = {
    __PACKAGE_NAME__: metadata.name,
    __PACKAGE_SPEC__: packageSpec,
    __PACKAGE_VERSION__: metadata.version,
    __PLAYWRIGHT_SPEC__: playwrightSpec,
  };

  let content = readFileSync(templatePath, "utf-8");
  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(token, value);
  }
  return content;
}

function resolveProjectRoot(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

function resolveGitHooksDir(cwd: string): string {
  try {
    return resolve(
      cwd,
      execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    exitWithCliError("`uat init hooks` must be run inside a Git repository.");
  }
}

function planWrites(config: InitConfig): PlannedWrite[] {
  const projectRoot = resolveProjectRoot(config.cwd);

  switch (config.target) {
    case "hooks":
      return [
        {
          content: renderTemplate("pre-commit"),
          executable: true,
          label: "pre-commit hook",
          path: join(resolveGitHooksDir(config.cwd), "pre-commit"),
        },
      ];
    case "github":
      return [
        {
          content: renderTemplate("uat-link-check.yml"),
          label: "GitHub workflow",
          path: join(projectRoot, ".github", "workflows", "uat-link-check.yml"),
        },
        {
          content: renderTemplate("uat-post-deploy-link-check.yml"),
          label: "GitHub workflow",
          path: join(
            projectRoot,
            ".github",
            "workflows",
            "uat-post-deploy-link-check.yml",
          ),
        },
      ];
    case "all":
      return [
        ...planWrites({ ...config, target: "hooks" }),
        ...planWrites({ ...config, target: "github" }),
      ];
  }
}

function ensureWritable(plan: PlannedWrite, force: boolean): "write" | "skip" {
  if (!existsSync(plan.path)) {
    return "write";
  }

  const existing = readFileSync(plan.path, "utf-8");
  if (existing === plan.content) {
    return "skip";
  }

  if (!force) {
    exitWithCliError(
      `Refusing to overwrite ${plan.path}. Re-run with --force to replace it.`,
    );
  }

  return "write";
}

function runInit(config: InitConfig): void {
  const plans = planWrites(config);
  const actions = plans.map((plan) => ({
    plan,
    action: ensureWritable(plan, config.force),
  }));

  if (config.dryRun) {
    console.log(`uat init ${config.target} dry run`);
    for (const { action, plan } of actions) {
      const verb = action === "skip" ? "skip" : "write";
      console.log(`  ${verb.toUpperCase()} ${plan.label}: ${plan.path}`);
    }
    return;
  }

  for (const { action, plan } of actions) {
    if (action === "skip") {
      console.log(`Already up to date: ${plan.path}`);
      continue;
    }

    mkdirSync(dirname(plan.path), { recursive: true });
    writeFileSync(plan.path, plan.content, "utf-8");
    if (plan.executable) {
      chmodSync(plan.path, 0o755);
    }
    console.log(`Installed ${plan.label}: ${plan.path}`);
  }
}

// ── Report persistence ──────────────────────────────────────────────

const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

function buildPlainReport(result: CrawlResult): string {
  const duration = (result.durationMs / 1000).toFixed(1);
  const lines: string[] = [
    "",
    "=== Link Check Report ===",
    `Base URL:       ${result.baseUrl}`,
    `Pages crawled:  ${result.pagesChecked}`,
    `Links checked:  ${result.linksChecked}`,
    `Duration:       ${duration}s`,
    "",
  ];

  if (result.brokenLinks.length === 0) {
    lines.push("No broken links found.");
  } else {
    lines.push(`Found ${result.brokenLinks.length} broken link(s):`, "");
    for (const link of result.brokenLinks) {
      const statusLabel =
        typeof link.status === "number"
          ? `${link.status} ${link.statusText}`
          : link.status.toUpperCase();
      lines.push(`  BROKEN ${statusLabel}`);
      lines.push(`  URL: ${link.url}`);
      if (link.foundOn.length > 0) {
        lines.push("  Found on:");
        for (const source of link.foundOn) {
          lines.push(`    - ${source}`);
        }
      }
      lines.push("");
    }
  }

  if (result.browserIssues && result.browserIssues.length > 0) {
    lines.push("");
    lines.push(`=== Browser Issues (${result.browserIssues.length}) ===`);
    lines.push(
      `Pages checked with browser: ${result.browserPagesChecked ?? 0}`,
    );
    lines.push("");
    for (const issue of result.browserIssues) {
      const label = issue.type.toUpperCase().replace("-", " ");
      lines.push(`  ${label}`);
      lines.push(`  Page: ${issue.pageUrl}`);
      lines.push(`  Detail: ${issue.detail}`);
      if (issue.element) lines.push(`  Element: ${issue.element}`);
      lines.push("");
    }
  } else if (result.browserPagesChecked != null) {
    lines.push("");
    lines.push("No browser issues found.");
  }

  return lines.join("\n");
}

function buildMarkdownReport(result: CrawlResult): string {
  const duration = (result.durationMs / 1000).toFixed(1);
  const lines: string[] = [
    "## Link Check Report",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Base URL | ${result.baseUrl} |`,
    `| Pages crawled | ${result.pagesChecked} |`,
    `| Links checked | ${result.linksChecked} |`,
    `| Duration | ${duration}s |`,
    "",
  ];

  if (result.brokenLinks.length === 0) {
    lines.push("### All links OK");
  } else {
    lines.push(`### ${result.brokenLinks.length} broken link(s) found`, "");
    lines.push("| Status | URL | Found on |");
    lines.push("|--------|-----|----------|");
    for (const link of result.brokenLinks) {
      const statusLabel =
        typeof link.status === "number"
          ? `${link.status} ${link.statusText}`
          : link.status.toUpperCase();
      const sources = link.foundOn.length > 0 ? link.foundOn.join(", ") : "-";
      lines.push(`| ${statusLabel} | ${link.url} | ${sources} |`);
    }
  }

  if (result.browserIssues && result.browserIssues.length > 0) {
    lines.push("");
    lines.push(`### ${result.browserIssues.length} browser issue(s) found`);
    lines.push(`Browser checked ${result.browserPagesChecked ?? 0} pages`);
    lines.push("");
    lines.push("| Type | Page | Detail | Element |");
    lines.push("|------|------|--------|---------|");
    for (const issue of result.browserIssues) {
      const label = issue.type.replace("-", " ");
      const el = issue.element ? `\`${issue.element}\`` : "-";
      lines.push(`| ${label} | ${issue.pageUrl} | ${issue.detail} | ${el} |`);
    }
  } else if (result.browserPagesChecked != null) {
    lines.push("");
    lines.push("### No browser issues found");
  }

  return lines.join("\n");
}

function saveReportsLocal(result: CrawlResult): string {
  const dir = join(process.cwd(), "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const ts = timestamp();
  const textPath = join(dir, `${ts}-report.txt`);
  const jsonPath = join(dir, `${ts}-report.json`);

  writeFileSync(textPath, buildPlainReport(result), "utf-8");
  const { crawledPages: _, ...output } = result;
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf-8");

  return dir;
}

function writeGitHubSummary(result: CrawlResult): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  appendFileSync(summaryPath, `${buildMarkdownReport(result)}\n`, "utf-8");
}

// ── Output formatters ───────────────────────────────────────────────

function printTextReport(result: CrawlResult): void {
  const plain = buildPlainReport(result);
  for (const line of plain.split("\n")) {
    if (
      line.includes("BROKEN") ||
      line.startsWith("  CONSOLE ERROR") ||
      line.startsWith("  NETWORK ERROR") ||
      line.startsWith("  BROKEN IMAGE") ||
      line.startsWith("  DEAD ELEMENT")
    ) {
      console.log(c.red(line));
    } else if (line.startsWith("===")) {
      console.log(c.bold(line));
    } else if (line.startsWith("  URL:") || line.startsWith("  Page:")) {
      console.log(c.cyan(line));
    } else if (
      line.startsWith("No broken links") ||
      line.startsWith("No browser issues")
    ) {
      console.log(c.green(line));
    } else if (line.startsWith("Found ")) {
      console.log(c.red(c.bold(line)));
    } else if (line.startsWith("  Detail:")) {
      console.log(c.yellow(line));
    } else {
      console.log(line);
    }
  }
}

function printJsonReport(result: CrawlResult): void {
  const { crawledPages: _, ...output } = result;
  console.log(JSON.stringify(output, null, 2));
}

// ── Entry point ─────────────────────────────────────────────────────

function log(config: Config, ...args: unknown[]): void {
  if (config.outputFormat !== "json") console.log(...args);
}

async function runCheck(config: Config): Promise<void> {
  log(config, c.bold("uat starting"));
  log(config, `  Target:      ${c.cyan(config.baseUrl)}`);
  log(config, `  Max pages:   ${config.maxPages}`);
  log(config, `  Concurrency: ${config.concurrency}`);
  log(config, `  External:    ${config.checkExternal ? "yes" : "no"}`);
  log(config, `  Browser:     ${config.browser ? "yes" : "no"}`);
  log(config, "");

  const result = await crawl(config, config.outputFormat === "json");

  // Run Playwright browser checks if requested
  if (config.browser) {
    log(config, "");
    log(config, c.bold("Running browser checks (Playwright)..."));

    const { runBrowserChecks } = await import("./browser.js");

    // Filter crawled pages to only those that responded OK (skip 404s etc.)
    const brokenUrls = new Set(result.brokenLinks.map((l) => l.url));
    const pagesToCheck = result.crawledPages.filter(
      (url) => !brokenUrls.has(url),
    );

    const browserResult = await runBrowserChecks({
      pages: pagesToCheck,
      concurrency: Math.min(config.concurrency, 3), // browser tabs are heavier
      timeout: config.timeout,
      verbose: config.verbose && config.outputFormat !== "json",
    });

    result.browserIssues = browserResult.issues;
    result.browserPagesChecked = browserResult.pagesChecked;
    result.durationMs += browserResult.durationMs;

    log(
      config,
      c.dim(
        `Browser checks done: ${browserResult.pagesChecked} pages, ${browserResult.issues.length} issues`,
      ),
    );
  }

  if (config.outputFormat === "json") {
    printJsonReport(result);
  } else {
    printTextReport(result);
  }

  // Persist reports
  if (isCI) {
    writeGitHubSummary(result);
  } else {
    const dir = saveReportsLocal(result);
    log(config, c.dim(`Reports saved to ${dir}/`));
  }

  const hasBrokenLinks = result.brokenLinks.length > 0;
  const hasBrowserIssues = (result.browserIssues?.length ?? 0) > 0;
  if ((hasBrokenLinks || hasBrowserIssues) && config.exitOnFailure) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));

  if (command.kind === "init") {
    runInit(command.config);
    return;
  }

  const config = parseCheckArgs(command.args);
  await runCheck(config);
}

main().catch((err) => {
  console.error(c.red("Fatal error:"), err);
  process.exit(2);
});
