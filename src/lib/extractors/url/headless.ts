import type { Browser, Page } from "playwright";
import { makeError } from "./errors";
const BROWSER_TIMEOUT_MS = 15_000;
const NAV_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 3_000_000;

export async function renderWithBrowser(url: string): Promise<string> {
  const { chromium } = await import("playwright");

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const timer = setTimeout(() => {
    browser.close().catch(() => {});
  }, BROWSER_TIMEOUT_MS);

  try {
    const page: Page = await browser.newPage({ javaScriptEnabled: true });

    await page.route("**/*", (route) => {
      const kind = route.request().resourceType();
      if (["image", "media", "font"].includes(kind)) return route.abort();
      route.continue();
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });

    await page.evaluate(() => {
      document.querySelectorAll("details").forEach((d) => {
        (d as HTMLDetailsElement).open = true;
      });
    });

    const html = await page.content();
    if (html.length > MAX_HTML_BYTES) {
      throw makeError(
        "TOO_LARGE",
        `Rendered HTML exceeds ${MAX_HTML_BYTES} bytes`
      );
    }
    return html;
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      throw makeError(
        "TIMEOUT",
        `Headless render timed out after ${BROWSER_TIMEOUT_MS} ms`,
        err
      );
    }
    throw makeError("FETCH_ERROR", "Headless browser failed", err);
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}
