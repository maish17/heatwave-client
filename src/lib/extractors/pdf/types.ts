import { ExtractorError } from "../common/errors";

export interface PdfExtractOptions {
  maxBytes?: number;
  maxPages?: number;
  normalizeWhitespace?: boolean;
}

export type PdfErrorCode =
  | "NOT_A_FILE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "READ_FAILED"
  | "PARSE_FAILED"
  | "ENCRYPTED"
  | "PAGE_READ_FAILED"
  | "NO_TEXT";

export class PdfExtractError extends ExtractorError<PdfErrorCode> {}
