import { makeError } from "./errors";

export function validateUrl(
  raw: string,
  allow?: string[],
  block?: string[]
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw makeError("INVALID_URL", "Malformed URL");
  }

  if (!/^https?:$/.test(url.protocol))
    throw makeError("INVALID_URL", "Only http/https allowed");

  if (allow && !allow.includes(url.hostname))
    throw makeError("BLOCKED_HOST", `Host ${url.hostname} not allowed`);

  if (block && block.includes(url.hostname))
    throw makeError("BLOCKED_HOST", `Host ${url.hostname} is blocked`);

  return url;
}
