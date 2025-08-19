import type { UrlExtractOptions, ExtractionResult, Tier } from "./types";
import { makeError } from "./errors";
import { validateUrl } from "./validate";
import { fetchHtmlWithLimits } from "./fetchHtml";
import { readabilityText } from "./readability";
import { fallbackBody } from "./fallback";
import { qualityGate } from "./quality";
import { rewriteToPrintUrl } from "./overrides";

export async function extractUrlText(
  rawUrl: string,
  opts: UrlExtractOptions = {}
): Promise<ExtractionResult> {
  const {
    timeoutMs = 5_000,
    maxBytes = 2_000_000,
    minLength = 200,
    normalizeWhitespace = true,
    allowHosts,
    blockHosts,
    enableHeadless = false,
  } = opts;

  const url = validateUrl(rawUrl, allowHosts, blockHosts);
  const limits = { timeoutMs, maxBytes } as const;

  /* 1 ─ static fetch → Readability */
  const html = await fetchHtmlWithLimits(url, limits);
  let text =
    (await readabilityText(html, url, { minLength, normalizeWhitespace })) ||
    fallbackBody(html);

  let meta = qualityGate(text);
  if (meta.passed) return build(text, meta, "readability");

  /* 2 ─ print view */
  const print = rewriteToPrintUrl(url);
  if (print) {
    const printHtml = await fetchHtmlWithLimits(print, limits);
    text =
      (await readabilityText(printHtml, print, {
        minLength,
        normalizeWhitespace,
      })) || fallbackBody(printHtml);

    meta = qualityGate(text);
    if (meta.passed) return build(text, meta, "print");
  }

  /* 3 ─ headless (opt-in) */
  if (enableHeadless) {
    const { renderWithBrowser } = await import("./headless.js");
    const renderedHtml = await renderWithBrowser(url.toString());
    text =
      (await readabilityText(renderedHtml, url, {
        minLength,
        normalizeWhitespace,
      })) || fallbackBody(renderedHtml);

    meta = qualityGate(text);
    if (meta.passed) return build(text, meta, "headless");
  }

  /* 4 ─ plain <body> */
  meta = qualityGate((text = fallbackBody(html)));
  if (meta.passed) return build(text, meta, "body-fallback");

  throw makeError("NO_TEXT", "Could not extract meaningful text");
}

/* helpers --------------------------------------------------------- */

function build(
  text: string,
  meta: ReturnType<typeof qualityGate>,
  tier: Tier
): ExtractionResult {
  return { text, tier, ...meta };
}
