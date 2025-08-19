import { ExtractorError } from "../common/errors";

export type UrlErrorCode =
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "FETCH_ERROR"
  | "TIMEOUT"
  | "TOO_LARGE"
  | "PARSE_ERROR"
  | "NO_TEXT";

export class UrlExtractError extends ExtractorError<UrlErrorCode> {}

export const makeError = (code: UrlErrorCode, msg: string, cause?: unknown) =>
  new UrlExtractError(code, msg, cause);
