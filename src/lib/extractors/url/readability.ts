import { normalizeWhitespace as normalize } from "../common/normalize";

export async function readabilityText(
  html: string,
  url: URL,
  {
    minLength = 200,
    normalizeWhitespace = true,
  }: { minLength?: number; normalizeWhitespace?: boolean } = {}
): Promise<string> {
  if (typeof window !== "undefined") return "";

  const [{ JSDOM }, { Readability }] = await Promise.all([
    import("jsdom"),
    import("@mozilla/readability"),
  ]);

  const dom = new JSDOM(html, { url: url.toString() });
  const doc = dom.window.document;

  // strip obvious noise
  ["script", "style", "noscript", "template", "nav", "footer"].forEach((sel) =>
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  );

  // (optional) expand <details>
  doc.querySelectorAll("details").forEach((detail: Element) => {
    const allText = Array.from(detail.querySelectorAll("*"))
      .map((el) => el.textContent?.trim() || "")
      .filter(Boolean)
      .join("\n\n");
    const wrapper = doc.createElement("div");
    wrapper.textContent = allText;
    detail.replaceWith(wrapper);
  });

  const article = new Readability(doc).parse();
  const articleText = article?.textContent ?? "";

  if (articleText.length >= minLength) {
    return normalizeWhitespace ? normalize(articleText) : articleText.trim();
  }

  return "";
}
