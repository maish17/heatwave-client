export { extractPdfText } from "./pdf/extract";
export { extractText } from "./text/extract";
export { extractUrlText } from "./url";

import { extractPdfText } from "./pdf/extract";
import { extractText } from "./text/extract";
import { extractUrlText } from "./url";
import { UrlExtractError } from "./url/errors";

import type { UploadData } from "@/types/uploads";
import { scrape } from "@/lib/api/scrape";

export interface ExtractResult {
  text: string;
  source: "pdf" | "url" | "text";
  extra?: unknown;
}

export async function runExtractor(data: UploadData): Promise<ExtractResult> {
  switch (data.source) {
    case "drop":
    case "dialog": {
      const text = await extractPdfText(data.file);
      return { text, source: "pdf" };
    }

    case "paste":
      if ("url" in data) {
        try {
          const { text } = await extractUrlText(data.url);
          return { text, source: "url" };
        } catch (err) {
          if (err instanceof UrlExtractError && err.code === "FETCH_ERROR") {
            const { text } = await scrape(data.url); // plain
            return { text, source: "url", extra: { via: "proxy" } };
          }
          throw err;
        }
      }

      {
        const text = await extractText(data.text);
        return { text, source: "text" };
      }
  }
}
