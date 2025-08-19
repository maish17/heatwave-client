export type UploadData =
  | { source: "drop" | "dialog"; file: File }
  | { source: "paste"; url: string }
  | { source: "paste"; text: string };

export interface BaseOptions {
  normalizeWhitespace?: boolean;
}

export interface ExtractResult {
  text: string;
  source: "pdf" | "url" | "text";
  extra?: unknown;
}

export interface ExtractionStats {
  length: number;
  paragraphCount: number;
  avgParagraphLen: number;
  keywordHits: number;
}
