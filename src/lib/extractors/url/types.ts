import type { ExtractionStats } from "../common/types";

/* public options for callers */
export interface UrlExtractOptions {
  timeoutMs?: number;
  maxBytes?: number;
  minLength?: number;
  normalizeWhitespace?: boolean;
  allowHosts?: string[];
  blockHosts?: string[];
  userAgent?: string;
  enableHeadless?: boolean;
}

/* which tier finally won */
export type Tier = "readability" | "print" | "headless" | "body-fallback";

export interface ExtractionResult {
  text: string;
  tier: Tier;
  passed: boolean;
  score: number;
  reasons: string[];
  stats: ExtractionStats;
}
