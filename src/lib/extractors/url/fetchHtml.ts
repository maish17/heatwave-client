import { makeError, UrlExtractError } from "./errors";
import { concatUint8 } from "./util";

export interface FetchLimits {
  timeoutMs: number;
  maxBytes: number;
  userAgent?: string;
}

export async function fetchHtmlWithLimits(
  url: URL,
  { timeoutMs, maxBytes, userAgent }: FetchLimits
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (userAgent && typeof window === "undefined")
      headers["User-Agent"] = userAgent;

    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers,
    }).catch((err) => {
      throw makeError("FETCH_ERROR", "Network error", err);
    });

    if (!res.ok) throw makeError("FETCH_ERROR", `HTTP ${res.status}`);

    const budget = +(res.headers.get("content-length") ?? 0);
    if (budget && budget > maxBytes)
      throw makeError("TOO_LARGE", "Body too large");

    /* … identical streaming logic … */
    if (res.body?.getReader) {
      const rd = res.body.getReader();
      const buf: Uint8Array[] = [];
      let got = 0;

      while (true) {
        const { done, value } = await rd.read();
        if (done) break;
        if (value) {
          got += value.length;
          if (got > maxBytes) throw makeError("TOO_LARGE", "Body too large");
          buf.push(value);
        }
      }
      return new TextDecoder().decode(concatUint8(buf));
    }

    const txt = await res.text();
    if (txt.length > maxBytes) throw makeError("TOO_LARGE", "Body too large");
    return txt;
  } catch (e: any) {
    if (e?.name === "AbortError")
      throw makeError("TIMEOUT", "Request timed out", e);
    if (e instanceof UrlExtractError) throw e;
    throw makeError("FETCH_ERROR", "Fetch failed", e);
  } finally {
    clearTimeout(timer);
  }
}
