import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type {
  DocumentInitParameters,
  TextItem,
} from "pdfjs-dist/types/src/display/api";
import { makeError } from "./errors";
import { normalizeWhitespace as norm } from "../common/normalize";
import { type PdfExtractOptions } from "./types";

export async function extractPdfText(
  file: File,
  opts: PdfExtractOptions = {}
): Promise<string> {
  const {
    maxBytes = 25 * 1024 * 1024,
    maxPages = 1_000,
    normalizeWhitespace = true,
  } = opts;

  if (!(file instanceof File))
    throw makeError("NOT_A_FILE", "Input is not a File");

  if (file.size === 0) throw makeError("EMPTY_FILE", "File is empty");

  if (file.size > maxBytes)
    throw makeError("FILE_TOO_LARGE", `File exceeds ${maxBytes} bytes`);

  const buffer = await file.arrayBuffer().catch(() => {
    throw makeError("READ_FAILED", "Unable to read file");
  });

  const params: DocumentInitParameters = {
    data: buffer,
    disableAutoFetch: true,
    disableStream: true,
  };

  const loadingTask = getDocument(params);

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === "PasswordException")
      throw makeError("ENCRYPTED", "PDF is password-protected", err);
    throw makeError("PARSE_FAILED", "Invalid or unsupported PDF", err);
  }

  try {
    const pages = Math.min(pdf.numPages, maxPages);
    const chunks: string[] = [];

    for (let i = 1; i <= pages; i++) {
      let items: TextItem[];

      try {
        const page = await pdf.getPage(i);
        const { items: raw } = await page.getTextContent();
        items = raw as TextItem[];
      } catch (err) {
        throw makeError("PAGE_READ_FAILED", `Failed page ${i}`, err);
      }

      const text = items
        .map((it) => ("str" in it ? it.str : ""))
        .filter(Boolean)
        .join(" ");

      chunks.push(text);
    }

    let out = chunks.join("\n\n");
    if (normalizeWhitespace) out = norm(out);

    // strip anomalous glyphs
    out = out
      .replace(
        /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Emoji}\n\r]+/gu,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

    if (!/\p{Script=Latin}/u.test(out))
      throw makeError("NO_TEXT", "No extractable text found");

    return out;
  } finally {
    await pdf.destroy().catch(() => {});
  }
}

const isBrowser =
  typeof window !== "undefined" && typeof navigator !== "undefined";

const isVitest =
  typeof globalThis.process !== "undefined" &&
  globalThis.process.env?.VITEST === "true";

if (isBrowser && !isVitest && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}
