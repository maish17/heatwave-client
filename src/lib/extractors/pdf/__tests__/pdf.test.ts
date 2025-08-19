import { describe, it, expect } from "vitest";
import { extractPdfText } from "@/lib/extractors/pdf";
import { fileFromFixture } from "../../../../tests/utils/pdf-fixture";

describe("extractPdfText", () => {
  it("sample: extracts known text", async () => {
    const text = await extractPdfText(await fileFromFixture("sample.pdf"));
    expect(text).toContain("Hello, world");
  });

  it("blank: throws", async () => {
    await expect(
      extractPdfText(await fileFromFixture("blank.pdf"))
    ).rejects.toThrow();
  });

  it("not-a-pdf: throws", async () => {
    await expect(
      extractPdfText(
        await fileFromFixture("not-a-pdf.bin", "application/octet-stream")
      )
    ).rejects.toThrow(/pdf/i);
  });

  it("corrupted: throws", async () => {
    await expect(
      extractPdfText(await fileFromFixture("corrupted.pdf"))
    ).rejects.toThrow();
  });

  it("locked: password error", async () => {
    await expect(
      extractPdfText(await fileFromFixture("locked.pdf"))
    ).rejects.toThrow(/password/i);
  });

  it("unicode: throws when there’s no Latin text", async () => {
    await expect(
      extractPdfText(await fileFromFixture("unicode.pdf"))
    ).rejects.toThrow(/No extractable text/);
  });

  it("image-only: throws", async () => {
    await expect(
      extractPdfText(await fileFromFixture("image-only.pdf"))
    ).rejects.toThrow();
  });

  it("huge: handles many pages", async () => {
    const text = await extractPdfText(await fileFromFixture("huge.pdf"));
    expect(text).toContain("Page 1");
    expect(text).toContain("Page 50");
  });

  it("concurrent: no cross bleed", async () => {
    const samplePromise = extractPdfText(await fileFromFixture("sample.pdf"));
    const unicodePromise = extractPdfText(await fileFromFixture("unicode.pdf"));

    await expect(samplePromise).resolves.toContain("Hello");
    await expect(unicodePromise).rejects.toThrow(/No extractable text/);
  });
});
