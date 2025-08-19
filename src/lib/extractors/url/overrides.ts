export function rewriteToPrintUrl(url: URL): URL | null {
  // Apple:  ?view=print
  if (url.hostname.endsWith("apple.com") && !url.searchParams.has("view")) {
    const clone = new URL(url.toString());
    clone.searchParams.set("view", "print");
    return clone;
  }
  return null;
}
