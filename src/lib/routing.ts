// src/lib/routing.ts
import { Capacitor } from "@capacitor/core";
import type { Feature, LineString } from "geojson";
import type { CustomModel } from "./ghModels";

/** Public types your UI already uses */
export type LngLat = [number, number];

export type GHInstruction = {
  distance: number; // meters
  time: number; // ms
  text: string; // “Turn left onto …”
  sign: number; // direction code
  interval: [number, number]; // [fromVertex, toVertex] in the polyline
  street_name?: string;
  last_heading?: number;
};

export type RouteResult = {
  distance: number; // meters
  duration: number; // seconds
  geometry: Feature<LineString>;
  waypoints: [LngLat, LngLat];
  instructions?: GHInstruction[]; // <-- NEW
  raw: any;
};

export type RouteOptions = {
  engine?: "graphhopper";
  ghProfile?: "foot_fastest" | "foot_balanced" | "foot_coolest";
  profile?: "walking" | "cycling" | "driving";
  customModel?: CustomModel | undefined;
  ghBaseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/* -------------------- Environment & defaults -------------------- */

function normalizeBase(input?: string): string | undefined {
  if (!input) return undefined;
  let s = input.trim();
  if (/^:\d+$/.test(s)) {
    const host =
      Capacitor.getPlatform() === "android" ? "10.0.2.2" : "localhost";
    s = `http://${host}${s}`;
  } else if (/^(localhost|\d{1,3}(\.\d{1,3}){3}):\d+$/.test(s)) {
    s = `http://${s}`;
  } else if (!/^https?:\/\//i.test(s) && /[A-Za-z]/.test(s)) {
    s = `http://${s}`;
  }
  return s.replace(/\/+$/, "");
}

const GH_BASE_DEFAULT =
  normalizeBase((import.meta.env as any).VITE_GH_BASE_URL) ??
  normalizeBase((import.meta.env as any).VITE_GRAPHHOPPER_BASE_URL) ??
  "https://gh.heatwaves.app";

const GH_API_KEY =
  ((import.meta.env as any).VITE_GH_API_KEY as string | undefined) ??
  ((import.meta.env as any).VITE_GRAPHHOPPER_API_KEY as string | undefined) ??
  undefined;

const DEFAULTS = { ghProfile: "foot_balanced" as const, timeoutMs: 12_000 };

/* -------------------- Small in-memory cache -------------------- */

const CACHE_TTL_MS = 30_000;
type CacheKey = `${string}|${number},${number}|${number},${number}|${string}`;
const cache = new Map<CacheKey, { t: number; value: RouteResult }>();

function cacheKey(
  base: string,
  a: LngLat,
  b: LngLat,
  profile: string
): CacheKey {
  return `${base}|${a[0]},${a[1]}|${b[0]},${b[1]}|${profile}` as CacheKey;
}

function isValidLngLat(p: LngLat) {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

function buildInit(init: RequestInit, signal?: AbortSignal): RequestInit {
  if (signal) (init as any).signal = signal;
  return init;
}

function composeTimeout(
  parent: AbortSignal | undefined,
  ms: number | undefined
): AbortSignal | undefined {
  if (!ms) return parent;
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  parent?.addEventListener("abort", onAbort, { once: true });
  const t = setTimeout(() => ctl.abort(), ms);
  ctl.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(t);
      parent?.removeEventListener("abort", onAbort);
    },
    { once: true }
  );
  return ctl.signal;
}

function resolveGhProfile(
  explicit: RouteOptions["ghProfile"],
  legacy: RouteOptions["profile"]
): "foot_fastest" | "foot_balanced" | "foot_coolest" {
  if (explicit) return explicit;
  if (!legacy || legacy === "walking") return "foot_balanced";
  if (legacy === "cycling" || legacy === "driving") {
    throw new Error(
      "This build is pedestrian-only. Use profile 'walking' or one of: foot_fastest | foot_balanced | foot_coolest."
    );
  }
  return "foot_balanced";
}

/* -------------------- Core: GraphHopper call -------------------- */

async function routeViaGraphHopper(
  from: LngLat,
  to: LngLat,
  options: RouteOptions
): Promise<RouteResult> {
  const base = normalizeBase(options.ghBaseUrl) ?? GH_BASE_DEFAULT;

  const isCloud = /graphhopper\.com\/api\/1$/i.test(base);
  if (isCloud && !GH_API_KEY) {
    throw new Error(
      "GraphHopper cloud requires an API key. Set VITE_GH_API_KEY or VITE_GRAPHHOPPER_API_KEY."
    );
  }
  const url = isCloud
    ? `${base}/route?key=${encodeURIComponent(GH_API_KEY!)}`
    : `${base}/route`;

  const profile = resolveGhProfile(options.ghProfile, options.profile);

  const points: [number, number][] = [
    [from[0], from[1]],
    [to[0], to[1]],
  ];

  const useCM = !!options.customModel;

  const body: Record<string, any> = {
    profile,
    points,
    points_encoded: false,
    instructions: true, // <-- ask for turn-by-turn
    locale: "en",
  };

  if (useCM) {
    body["ch.disable"] = true;
    body.custom_model = options.customModel;
  }

  const signal = composeTimeout(
    options.signal,
    options.timeoutMs ?? DEFAULTS.timeoutMs
  );

  const resp = await fetch(
    url,
    buildInit(
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      signal
    )
  );

  const text = await resp.text();
  if (!resp.ok) {
    let msg = `GraphHopper ${resp.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.message) msg += ` — ${j.message}`;
      if (j?.hints?.[0]?.message) msg += ` — ${j.hints[0].message}`;
    } catch {}
    throw new Error(msg);
  }

  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("GraphHopper returned invalid JSON.");
  }

  const path = data?.paths?.[0];
  if (!path?.points) {
    if (import.meta.env.DEV) console.error("[GH] Unexpected response:", data);
    throw new Error(
      "GraphHopper: no route found (check points, profile, or server profiles)."
    );
  }

  const pts = path.points as {
    type: "LineString";
    coordinates: [number, number][];
  };

  const feature: Feature<LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: pts.coordinates },
    properties: {},
  };

  const instructions: GHInstruction[] = Array.isArray(path.instructions)
    ? path.instructions.map((s: any) => ({
        distance: Number(s.distance) || 0,
        time: Number(s.time) || 0,
        text: String(s.text ?? ""),
        sign: Number(s.sign ?? 0),
        interval: Array.isArray(s.interval)
          ? [s.interval[0], s.interval[1]]
          : [0, 0],
        street_name: s.street_name,
        last_heading:
          typeof s.last_heading === "number" ? s.last_heading : undefined,
      }))
    : [];

  return {
    distance: Number(path.distance) || 0,
    duration: (Number(path.time) || 0) / 1000, // ms -> s
    geometry: feature,
    waypoints: [from, to],
    instructions,
    raw: data,
  };
}

/* -------------------- Public entry point -------------------- */

export async function routeBetween(
  from: LngLat,
  to: LngLat,
  options: RouteOptions = {}
): Promise<RouteResult> {
  if (!isValidLngLat(from) || !isValidLngLat(to)) {
    throw new Error("Invalid coordinates for routeBetween");
  }

  const base = (
    options.ghBaseUrl ? normalizeBase(options.ghBaseUrl) : GH_BASE_DEFAULT
  )!;

  const profKey = resolveGhProfile(options.ghProfile, options.profile);
  const k = cacheKey(base.replace(/\/+$/, ""), from, to, profKey);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && now - hit.t < CACHE_TTL_MS) return hit.value;

  const result = await routeViaGraphHopper(from, to, {
    ...options,
    ghProfile: profKey,
  });
  cache.set(k, { t: now, value: result });
  return result;
}
