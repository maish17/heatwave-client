export type ForwardHit = {
  id: string;
  label: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  src?: "mapbox" | "osm";
};

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "heatwave-client/0.1 (mmoylemaish@icloud.com)";

const MBX = "https://api.mapbox.com/geocoding/v5/mapbox.places/";
const MBX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const MBX_TYPES =
  "address,place,locality,neighborhood,postcode,region,country,poi";

const TX_W = -107.0;
const TX_S = 25.5;
const TX_E = -93.0;
const TX_N = 36.7;
const TX_BBOX_ARR: [number, number, number, number] = [TX_W, TX_S, TX_E, TX_N];
const TX_BBOX_STR = `${TX_W},${TX_S},${TX_E},${TX_N}`;
const TX_VIEWBOX_STR = `${TX_W},${TX_N},${TX_E},${TX_S}`;

const MIN_QUERY_LEN = 3;

type CacheEntry<T> = { t: number; v: T };
const CACHE_TTL_MS_FWD = 10 * 60 * 1000;
const CACHE_TTL_MS_REV = 30 * 60 * 1000;
const MAX_CACHE = 300;

const forwardCache = new Map<string, CacheEntry<ForwardHit[]>>();
const reverseCache = new Map<string, CacheEntry<{ label: string; raw: any }>>();
const inflightFwd = new Map<string, Promise<ForwardHit[]>>();
const inflightRev = new Map<string, Promise<{ label: string; raw: any }>>();

function trimLRU<T>(m: Map<string, T>, max = MAX_CACHE) {
  while (m.size > max) {
    const it = m.keys().next();
    if (it.done) break;
    const k = it.value;
    if (typeof k === "string") {
      m.delete(k);
    } else {
      break;
    }
  }
}
function round(x: number, d = 3) {
  const p = 10 ** d;
  return Math.round(x * p) / p;
}
function fwdKey(
  q: string,
  opts?: { proximity?: [number, number]; lang?: string; limit?: number }
) {
  const prox = opts?.proximity
    ? `${round(opts.proximity[0])},${round(opts.proximity[1])}`
    : "";
  return `${q.toLowerCase()}|${prox}|${opts?.lang ?? "en"}|${opts?.limit ?? 8}`;
}
function revKey(lng: number, lat: number, lang?: string) {
  return `${round(lng, 5)},${round(lat, 5)}|${lang ?? "en"}`;
}

function redact(url: string) {
  return url.replace(/access_token=[^&]+/, () => {
    const tail = MBX_TOKEN ? MBX_TOKEN.slice(-6) : "no-token";
    return `access_token=***${tail}`;
  });
}

function centerInBbox(
  center?: [number, number],
  bbox?: [number, number, number, number]
) {
  const [w, s, e, n] = bbox ?? TX_BBOX_ARR;
  if (!center) return false;
  const [lng, lat] = center;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

export async function forwardGeocode(
  query: string,
  opts?: {
    proximity?: [number, number];
    limit?: number;
    lang?: string;
    countrycodes?: string;
  }
): Promise<ForwardHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LEN) return [];

  const key = fwdKey(q, opts);
  const now = Date.now();

  const hit = forwardCache.get(key);
  if (hit && now - hit.t < CACHE_TTL_MS_FWD) return hit.v;

  if (inflightFwd.has(key)) return inflightFwd.get(key)!;

  const task = (async () => {
    let result: ForwardHit[] = [];
    if (MBX_TOKEN) {
      try {
        result = await mapboxForward(q, opts);
      } catch (e) {
        console.warn("[geocode] mapbox failed, falling back:", e);
      }
    } else {
      console.warn(
        "[geocode] No VITE_MAPBOX_TOKEN set; falling back to OSM (slower)."
      );
    }
    if (!result.length) {
      try {
        result = await nominatimForward(q, opts);
      } catch (e) {
        console.error("[geocode] nominatim failed:", e);
        result = [];
      }
    }
    forwardCache.set(key, { t: Date.now(), v: result });
    trimLRU(forwardCache);
    return result;
  })();

  inflightFwd.set(key, task);
  try {
    return await task;
  } finally {
    inflightFwd.delete(key);
  }
}

export async function reverseGeocode(
  lng: number,
  lat: number,
  lang?: string
): Promise<{ label: string; raw: any }> {
  const key = revKey(lng, lat, lang);
  const now = Date.now();

  const hit = reverseCache.get(key);
  if (hit && now - hit.t < CACHE_TTL_MS_REV) return hit.v;

  if (inflightRev.has(key)) return inflightRev.get(key)!;

  const task = (async () => {
    let res: { label: string; raw: any };
    if (MBX_TOKEN) {
      try {
        res = await mapboxReverse(lng, lat, lang);
      } catch (e) {
        console.warn("[reverse] mapbox failed, falling back:", e);
        res = await nominatimReverse(lng, lat, lang);
      }
    } else {
      res = await nominatimReverse(lng, lat, lang);
    }
    reverseCache.set(key, { t: Date.now(), v: res });
    trimLRU(reverseCache);
    return res;
  })();

  inflightRev.set(key, task);
  try {
    return await task;
  } finally {
    inflightRev.delete(key);
  }
}

async function mapboxForward(
  query: string,
  opts?: {
    proximity?: [number, number];
    limit?: number;
    lang?: string;
    countrycodes?: string;
  }
): Promise<ForwardHit[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 10);
  const url = new URL(`${MBX}${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", MBX_TOKEN!);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("fuzzyMatch", "true");
  url.searchParams.set("types", MBX_TYPES);
  url.searchParams.set("bbox", TX_BBOX_STR);
  url.searchParams.set("country", "us");
  if (opts?.lang) url.searchParams.set("language", opts.lang);
  if (opts?.proximity) {
    const [lng, lat] = opts.proximity;
    url.searchParams.set("proximity", `${lng},${lat}`);
  }

  if (import.meta.env.DEV)
    console.debug("[mapbox fwd] GET", redact(url.toString()));

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    let detail = "";
    try {
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await resp.json();
        detail = j?.message || JSON.stringify(j);
      } else {
        detail = await resp.text();
      }
    } catch {}
    console.error(`[mapbox fwd] ${resp.status} ${resp.statusText} ${detail}`);
    throw new Error(
      `Mapbox geocode failed: ${resp.status}${detail ? ` — ${detail}` : ""}`
    );
  }

  const data = await resp.json();
  const feats = (data?.features ?? []) as Array<any>;
  const filtered = feats.filter((f) => centerInBbox(f?.center, f?.bbox));
  return filtered.map((f) => {
    const id = String(f?.id ?? Math.random());
    const label = String(f?.place_name ?? f?.text ?? "Unknown place");
    const center = f?.center as [number, number];
    const bbox = f?.bbox as [number, number, number, number] | undefined;
    const base = { id, label, center, src: "mapbox" as const };
    return bbox ? { ...base, bbox } : base;
  });
}

async function mapboxReverse(
  lng: number,
  lat: number,
  lang?: string
): Promise<{ label: string; raw: any }> {
  const url = new URL(`${MBX}${lng},${lat}.json`);
  url.searchParams.set("access_token", MBX_TOKEN!);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", MBX_TYPES);
  url.searchParams.set("country", "us");
  if (lang) url.searchParams.set("language", lang);

  if (import.meta.env.DEV)
    console.debug("[mapbox rev] GET", redact(url.toString()));

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    let detail = "";
    try {
      detail = await resp.text();
    } catch {}
    throw new Error(
      `Mapbox reverse failed: ${resp.status}${detail ? ` — ${detail}` : ""}`
    );
  }
  const data = await resp.json();
  const label = data?.features?.[0]?.place_name ?? "Unknown location";
  return { label, raw: data };
}

async function nominatimForward(
  query: string,
  opts?: {
    proximity?: [number, number];
    limit?: number;
    lang?: string;
    countrycodes?: string;
  }
): Promise<ForwardHit[]> {
  const limit = opts?.limit ?? 8;
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", TX_VIEWBOX_STR);
  url.searchParams.set("bounded", "1");
  if (opts?.lang) url.searchParams.set("accept-language", opts.lang);

  if (import.meta.env.DEV) console.debug("[nominatim fwd] GET", url.toString());

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!resp.ok) throw new Error(`Nominatim geocode failed: ${resp.status}`);
  const data = await resp.json();

  const feats = (data?.features ?? []) as Array<any>;
  const filtered = feats.filter((f) =>
    centerInBbox(f?.geometry?.coordinates as any, f?.bbox as any)
  );

  return filtered.map((f) => {
    const id = String(
      f?.properties?.osm_id ??
        (globalThis.crypto as any)?.randomUUID?.() ??
        Math.random()
    );
    const label = f?.properties?.display_name ?? "Unknown place";
    const center = f?.geometry?.coordinates as [number, number];
    const bbox = f?.bbox as [number, number, number, number] | undefined;
    const base = { id, label, center, src: "osm" as const };
    return bbox ? { ...base, bbox } : base;
  });
}

async function nominatimReverse(
  lng: number,
  lat: number,
  lang?: string
): Promise<{ label: string; raw: any }> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("format", "jsonv2");
  if (lang) url.searchParams.set("accept-language", lang);

  if (import.meta.env.DEV) console.debug("[nominatim rev] GET", url.toString());

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!resp.ok) throw new Error(`Nominatim reverse failed: ${resp.status}`);
  const j = await resp.json();
  return { label: j?.display_name ?? "Unknown location", raw: j };
}
