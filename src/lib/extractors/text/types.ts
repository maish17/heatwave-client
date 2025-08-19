import { ExtractorError } from "../common/errors";

export interface TextExtractOptions {
  maxLength?: number;
  normalizeWhitespace?: boolean;
}

export type TextErrorCode = "EMPTY_TEXT" | "TEXT_TOO_LONG" | "NO_TEXT";

export class TextExtractError extends ExtractorError<TextErrorCode> {}
