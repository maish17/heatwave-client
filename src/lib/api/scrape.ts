// src/lib/api/scrape.ts
export async function scrape(
  url: string,
  opts?: { ua?: boolean; headless?: boolean }
) {
  const params = new URLSearchParams({ url });

  if (opts?.ua) params.set("ua", "desktop");
  if (opts?.headless) params.set("headless", "1");

  const r = await fetch(`http://localhost:3301/scrape?${params}`);
  const json = await r.json();
  if (!r.ok) throw new Error(json.message ?? json.error ?? `proxy ${r.status}`);
  return json as { text: string };
}
