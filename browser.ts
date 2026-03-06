import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

// ── Types ────────────────────────────────────────────────────────────

export interface BrowserIssue {
  type: "console-error" | "network-error" | "broken-image" | "dead-element";
  pageUrl: string;
  detail: string;
  element?: string;
}

export interface BrowserCheckResult {
  pagesChecked: number;
  issues: BrowserIssue[];
  durationMs: number;
}

export interface BrowserCheckConfig {
  pages: string[];
  concurrency: number;
  timeout: number;
  verbose: boolean;
}

// ── Static asset extensions the HTTP crawler already checks ──────────

const STATIC_ASSET_RE = /\.(css|js|mjs|woff2?|ttf|eot|otf|map)(\?.*)?$/i;

// ── Per-page checker ─────────────────────────────────────────────────

async function checkPage(
  url: string,
  browser: Browser,
  timeout: number,
): Promise<BrowserIssue[]> {
  const issues: BrowserIssue[] = [];
  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();

  // a. Console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      issues.push({
        type: "console-error",
        pageUrl: url,
        detail: msg.text(),
      });
    }
  });

  // a. Unhandled page exceptions
  page.on("pageerror", (err) => {
    issues.push({
      type: "console-error",
      pageUrl: url,
      detail: `Unhandled exception: ${err.message}`,
    });
  });

  // b. Network failures from JS (fetch / XHR) — skip document + static assets
  let documentUrl: string | null = null;
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;

    const respUrl = response.url();

    // Skip the initial document request
    if (respUrl === documentUrl) return;

    // Skip static assets (already covered by HTTP crawler)
    if (STATIC_ASSET_RE.test(new URL(respUrl).pathname)) return;

    // Only collect XHR / fetch initiated requests
    const resourceType = response.request().resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch") return;

    issues.push({
      type: "network-error",
      pageUrl: url,
      detail: `${status} ${response.statusText()} — ${respUrl}`,
      element: respUrl,
    });
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout,
    });
    documentUrl = response?.url() ?? url;

    // c. Broken images
    const brokenImages = await page.evaluate((): { src: string; alt: string }[] => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const broken: { src: string; alt: string }[] = [];
      for (const img of imgs) {
        const src = img.getAttribute("src") ?? "";
        // Skip empty src and tiny SVG placeholders
        if (!src || src.startsWith("data:")) continue;
        const isSvgTiny =
          src.toLowerCase().endsWith(".svg") &&
          img.naturalWidth < 10 &&
          img.naturalHeight < 10;
        if (isSvgTiny) continue;
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
          broken.push({
            src,
            alt: img.getAttribute("alt") ?? "",
          });
        }
      }
      return broken;
    });

    for (const img of brokenImages) {
      const selector = img.alt ? `img[alt="${img.alt}"]` : `img[src="${img.src}"]`;
      issues.push({
        type: "broken-image",
        pageUrl: url,
        detail: `Broken image: ${img.src}`,
        element: selector,
      });
    }

    // d. Dead elements — visible in DOM but zero-sized / invisible
    const deadElements = await page.evaluate((): { selector: string; tag: string }[] => {
      const candidates = Array.from(
        document.querySelectorAll('a[href], button, [role="button"], [onclick]'),
      ).slice(0, 50);

      const dead: { selector: string; tag: string }[] = [];
      for (const el of candidates) {
        const element = el as HTMLElement;
        const style = window.getComputedStyle(element);
        const hiddenByAttributes =
          element.hidden ||
          element.getAttribute("aria-hidden") === "true" ||
          element.closest("[hidden], [aria-hidden='true']") !== null;
        const hiddenByStyle =
          style.display === "none" ||
          style.display === "contents" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          style.pointerEvents === "none";
        const hiddenByLayout =
          element.getClientRects().length === 0 &&
          element.offsetParent === null &&
          style.position !== "fixed";

        if (hiddenByAttributes || hiddenByStyle || hiddenByLayout) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          const tag = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : "";
          const cls = element.className && typeof element.className === "string"
            ? "." + element.className.trim().split(/\s+/).join(".")
            : "";
          const text = element.textContent?.trim().slice(0, 30) ?? "";
          dead.push({ selector: `${tag}${id}${cls}`, tag: text || tag });
        }
      }
      return dead;
    });

    for (const el of deadElements) {
      issues.push({
        type: "dead-element",
        pageUrl: url,
        detail: `Element exists in DOM but has zero dimensions: "${el.tag}"`,
        element: el.selector,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[browser] navigation failed for ${url}: ${message}`);
  } finally {
    await context.close();
  }

  return issues;
}

// ── Worker pool ──────────────────────────────────────────────────────

export async function runBrowserChecks(
  config: BrowserCheckConfig,
): Promise<BrowserCheckResult> {
  const startTime = Date.now();
  const allIssues: BrowserIssue[] = [];

  const browser = await chromium.launch({ headless: true });

  try {
    const queue = [...config.pages];
    let pagesChecked = 0;

    // Spin up `concurrency` workers that each pull from the shared queue
    const workers = Array.from({ length: config.concurrency }, async () => {
      while (true) {
        const url = queue.shift();
        if (url === undefined) break;

        if (config.verbose) {
          console.error(`[browser] checking ${url}`);
        }

        const issues = await checkPage(url, browser, config.timeout);
        allIssues.push(...issues);
        pagesChecked++;
      }
    });

    await Promise.all(workers);

    return {
      pagesChecked,
      issues: allIssues,
      durationMs: Date.now() - startTime,
    };
  } finally {
    await browser.close();
  }
}
