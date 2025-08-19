import { describe, it, expect } from "vitest";
import { extractText, TextExtractError } from "@/lib/extractors/text";

describe("extractText", () => {
  it("simple: normalizes whitespace and returns clean text", async () => {
    const raw = " Hello world\r\n\r\nThis     is\t\ta test. ";
    const cleaned = await extractText(raw);
    expect(cleaned).toBe("Hello world\n\nThis is a test.");
  });

  it("preserves raw when normalization disabled", async () => {
    const raw = "Line1\r\n\r\nLine2";
    const result = await extractText(raw, { normalizeWhitespace: false });
    expect(result).toBe("Line1\r\n\r\nLine2");
  });

  it("empty: throws EMPTY_TEXT", async () => {
    await expect(extractText("   ")).rejects.toBeInstanceOf(TextExtractError);
    await expect(extractText("   ")).rejects.toMatchObject({
      code: "EMPTY_TEXT",
    });
  });

  it("too long: throws TEXT_TOO_LONG", async () => {
    const long = "x".repeat(500);
    await expect(extractText(long, { maxLength: 100 })).rejects.toMatchObject({
      code: "TEXT_TOO_LONG",
    });
  });

  it("no-latin: throws NO_TEXT when only non-Latin chars", async () => {
    await expect(extractText("你好，世界")).rejects.toMatchObject({
      code: "NO_TEXT",
    });
  });

  it("concurrent: isolated errors and results", async () => {
    const pGood = extractText("Hello");
    const pBad = extractText("こんにちは");
    await expect(pGood).resolves.toBe("Hello");
    await expect(pBad).rejects.toMatchObject({ code: "NO_TEXT" });
  });
});
