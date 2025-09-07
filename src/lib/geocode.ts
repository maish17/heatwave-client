export type ForwardHit = {
  id: string;
  label: string;
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [west, south, east, north]
  /** optional: which provider returned this result */
  src?: "mapbox" | "osm";
};

const NOMINATIM = "https://nominatim.openstreetmap.org";
// 👇 put a real email per Nominatim policy
const UA = "heatwave-client/0.1 (you@example.com)";

const MBX = "https://api.mapbox.com/geocoding/v5/mapbox.places/";
const MBX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Valid Mapbox geocoding types (no `street`)
const MBX_TYPES =
  "address,place,locality,neighborhood,postcode,region,country,poi";

// --- Texas clamp (slightly padded) ---
const TX_W = -107.0;
const TX_S = 25.5;
const TX_E = -93.0;
const TX_N = 36.7;
const TX_BBOX_ARR: [number, number, number, number] = [TX_W, TX_S, TX_E, TX_N];
const TX_BBOX_STR = `${TX_W},${TX_S},${TX_E},${TX_N}`; // mapbox (minX,minY,maxX,maxY)
const TX_VIEWBOX_STR = `${TX_W},${TX_N},${TX_E},${TX_S}`; // nominatim (left,top,right,bottom)

// central place to enforce a min length (avoid 422s on "1", "16", etc.)
const MIN_QUERY_LEN = 3;

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

/** Forward geocode (Mapbox first, then Nominatim), RESTRICTED TO TEXAS */
export async function forwardGeocode(
  query: string,
  opts?: {
    proximity?: [number, number];
    limit?: number;
    lang?: string;
    countrycodes?: string; // will be forced to "us" anyway
  }
): Promise<ForwardHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LEN) {
    if (import.meta.env.DEV)
      console.debug(`[geocode] skip short query: "${q}"`);
    return [];
  }

  if (MBX_TOKEN) {
    try {
      const hits = await mapboxForward(q, opts);
      if (hits.length) return hits;
    } catch (e) {
      console.warn("[geocode] mapbox failed, falling back:", e);
    }
  } else {
    console.warn(
      "[geocode] No VITE_MAPBOX_TOKEN set; address matches may be limited."
    );
  }

  try {
    return await nominatimForward(q, opts);
  } catch (e) {
    console.error("[geocode] nominatim failed:", e);
    return [];
  }
}

/** Reverse geocode (Mapbox first, then Nominatim) */
export async function reverseGeocode(
  lng: number,
  lat: number,
  lang?: string
): Promise<{ label: string; raw: any }> {
  if (MBX_TOKEN) {
    try {
      return await mapboxReverse(lng, lat, lang);
    } catch (e) {
      console.warn("[reverse] mapbox failed, falling back:", e);
    }
  }
  return await nominatimReverse(lng, lat, lang);
}

// ---------- Mapbox impls ----------
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
  url.searchParams.set("bbox", TX_BBOX_STR); // 🔒 restrict to Texas
  url.searchParams.set("country", "us"); // extra guard
  if (opts?.lang) url.searchParams.set("language", opts.lang);
  // proximity still helps ranking *within* the bbox
  if (opts?.proximity) {
    const [lng, lat] = opts.proximity; // MUST be "lng,lat"
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
  // Safety filter (in case of any odd result spillover)
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

// ---------- Nominatim impls ----------
async function nominatimForward(
  query: string,
  opts?: {
    proximity?: [number, number]; // ignored for OSM when bounded
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
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us"); // guard to US
  // 🔒 hard clamp to Texas
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
  // Safety filter to TX bbox (should already be bounded)
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
