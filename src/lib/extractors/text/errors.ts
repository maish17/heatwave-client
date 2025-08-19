import { ExtractorError } from "../common/errors";

export type TextErrorCode = "EMPTY_TEXT" | "TEXT_TOO_LONG" | "NO_TEXT";

export class TextExtractError extends ExtractorError<TextErrorCode> {}

export const makeError = (code: TextErrorCode, msg: string, cause?: unknown) =>
  new TextExtractError(code, msg, cause);
