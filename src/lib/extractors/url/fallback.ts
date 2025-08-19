import { normalizeWhitespace as normalize } from "../common/normalize";

export function fallbackBody(html: string): string {
  return normalize(stripTags(html));
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}
