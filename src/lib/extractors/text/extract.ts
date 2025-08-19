import { normalizeWhitespace as norm } from "../common/normalize";
import { type TextExtractOptions } from "./types";
import { makeError } from "./errors";

export async function extractText(
  raw: string,
  opts: TextExtractOptions = {}
): Promise<string> {
  const { maxLength = 10_000_000, normalizeWhitespace = true } = opts;

  if (typeof raw !== "string") {
    throw makeError("EMPTY_TEXT", "Input must be a string");
  }

  const trimmed = raw.trim();
  if (!trimmed) throw makeError("EMPTY_TEXT", "No text provided");
  if (trimmed.length > maxLength) {
    throw makeError(
      "TEXT_TOO_LONG",
      `Text exceeds maximum length of ${maxLength} characters`
    );
  }

  let result = normalizeWhitespace ? norm(trimmed) : trimmed;

  result = result.replace(
    /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Emoji}\n\r]+/gu,
    ""
  );

  result = normalizeWhitespace ? norm(result) : result;

  if (!/\p{Script=Latin}/u.test(result)) {
    throw makeError("NO_TEXT", "No extractable text found");
  }

  return result;
}
