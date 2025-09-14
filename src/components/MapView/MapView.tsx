// src/components/MapView/MapView.tsx
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol, PMTiles } from "pmtiles";
import { reverseGeocode } from "../../lib/geocode";
import { routeBetween, type LngLat } from "../../lib/routing";
import SearchBox from "../SeachBox/SearchBox";
import BottomBar from "../BottomBar";
import { Geolocation } from "@capacitor/geolocation";
import NavPanel from "../NavPanel/NavPanel";
import { snapToLine, lengthBetween } from "../../lib/nav";
import type { RouteResult } from "../../lib/routing";
import type { ExpressionSpecification } from "maplibre-gl";
import { openInfo, INFO_URL } from "../../lib/openInfo";
import { Capacitor } from "@capacitor/core";

let pmtilesRegistered = false;

// Your vector tiles (preferred)
const PMTILES_URL = "https://tiles.heatwaves.app/texas.pmtiles";

// Guaranteed-safe fallback style so the map always renders
const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

const COLORS = {
  bg: "#E6D2BC",
  text: "#1B1E22",
  heat2: "#5c0f14", // destination pin
  coolPin: "#e19638", //"#1FB5AD", // me pin
  land: "#EEE3D5",
  water: "#F7F2EA",
  greens: "#D1C9B0",
  bldg: "#E9D8C6",
  bldgLine: "#CDB79E",
  roadMinor: "#E8DACB",
  roadPrim: "#D7C1A8",
  roadHwy: "#C9AB89",
  roadCase: "#B69372",
  hwyLabel: "#3D322B",

  // Route styling
  routeHalo: "#ffffff",
  routeFast: "#5c0f14", //"#D0532B", // warmest
  routeBalanced: "#b44427", //"#0d6e69", // mid
  routeCool: "#e19638", //"#1FB5AD", // coolest
};

type View = { center: [number, number]; zoom: number };

// Route source/layer IDs
const SRC_FAST = "hw-route-fast-src";
const SRC_BAL = "hw-route-bal-src";
const SRC_COOL = "hw-route-cool-src";

const LYR_FAST_HALO = "hw-route-fast-halo";
const LYR_FAST = "hw-route-fast";
const LYR_BAL_HALO = "hw-route-bal-halo";
const LYR_BAL = "hw-route-bal";
const LYR_COOL_HALO = "hw-route-cool-halo";
const LYR_COOL = "hw-route-cool";

/** Camera constants */
const NAV_ZOOM = 18; // zoom when actively navigating (tight)
const NAV_PITCH = 0; // top-down (no 3D)
const PICKER_ZOOMOUT_DELTA = 0.15; // ~10–11% zoom-out in WebMercator terms

/** geo helpers */
function lineFeature(a: LngLat, b: LngLat) {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [a, b] },
    properties: {},
  } as const;
}

// ---------- persistent view helpers ----------
declare global {
  interface Window {
    __HW_VIEW__?: View;
  }
}
function parseHashView(): View | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(
    /^#?(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/
  );
  if (!m) return null;
  const z = Number(m[1]);
  const lat = Number(m[2]);
  const lng = Number(m[3]);
  if (Number.isFinite(z) && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { center: [lng, lat], zoom: z };
  }
  return null;
}
function loadInitialView(): View {
  const fromHash = parseHashView();
  if (fromHash) return fromHash;
  if (typeof window !== "undefined" && window.__HW_VIEW__) {
    return window.__HW_VIEW__!;
  }
  try {
    const s = sessionStorage.getItem("hw:view");
    if (s) return JSON.parse(s) as View;
  } catch {}
  return { center: [-99.965735, 31.09691], zoom: 5 };
}
function saveView(v: View) {
  if (typeof window !== "undefined") window.__HW_VIEW__ = v;
  try {
    sessionStorage.setItem("hw:view", JSON.stringify(v));
  } catch {}
}

// ---------- tiny utils ----------
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );
}
function distMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const M_PER_MI = 1609.344;
const WALKING_MPH = 2;

function fmtDurationHM(sec?: number, distanceM?: number) {
  // fallback: compute from distance at ~2 mph if time missing
  let s = sec;
  if (
    (s == null || !Number.isFinite(s)) &&
    Number.isFinite(distanceM as number)
  ) {
    const miles = (distanceM as number) / M_PER_MI;
    s = (miles / WALKING_MPH) * 3600;
  }
  if (s == null || !Number.isFinite(s)) return "—";
  const totalMin = Math.max(1, Math.round(s / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h >= 1 ? `${h} hr ${m} min` : `${totalMin} min`;
}
function fmtMiles(distanceM?: number) {
  if (distanceM == null || !Number.isFinite(distanceM)) return "—";
  const mi = distanceM / M_PER_MI;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

// planar meters helpers for bearing/segment math
const M_PER_DEG_LAT = 110_540;
function M_PER_DEG_LON_AT(latDeg: number) {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

// “heading from A to B” in degrees, clockwise from north
function bearingDeg(a: LngLat, b: LngLat) {
  const midLat = (a[1] + b[1]) / 2;
  const kx = M_PER_DEG_LON_AT(midLat),
    ky = M_PER_DEG_LAT;
  const dx = (b[0] - a[0]) * kx;
  const dy = (b[1] - a[1]) * ky;
  const rad = Math.atan2(dx, dy); // dx,dy so 0° is north, 90° is east
  return (rad * 180) / Math.PI;
}

// ================= Component =================
type TripStats = { durationSec: number; distanceM: number };
type AllStats = Partial<Record<"fast" | "bal" | "cool", TripStats>>;

export default function MapView() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const viewRef = useRef<View>(loadInitialView());
  const lastFixRef = useRef<LngLat | null>(null);
  const routesRef = useRef<{
    fast?: RouteResult;
    bal?: RouteResult;
    cool?: RouteResult;
  }>({});

  type NavState = {
    profile: "fast" | "bal" | "cool";
    route: RouteResult;
    stepIndex: number;
    startedAt: number;
    offRouteSince?: number | null;
    stepRemainingM?: number;
    totalRemainingM?: number;
  };
  const [nav, _setNav] = useState<NavState | null>(null);
  // MapView.tsx (top-level in component)
  const [searchText, setSearchText] = useState("");
  const [revBusy, setRevBusy] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);

  const requestLocation = () => {
    // Trigger the browser prompt via a user gesture
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      () => {
        setNeedsLocation(false);
        startFollowing(true);
      },
      (err) => {
        console.warn("[geo] getCurrentPosition error:", err);
        setNeedsLocation(true);
        alert(
          "Location permission is blocked. In Safari, tap the aA button → Website Settings → Location: Allow and turn on Precise Location."
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  // keep latest nav in a ref so watchPosition sees fresh state
  const navRef = useRef<NavState | null>(null);
  function setNavNow(next: NavState | null) {
    navRef.current = next;
    _setNav(next);
  }

  // routing state
  const routeDestRef = useRef<LngLat | null>(null);
  const routeReadyRef = useRef(false);

  // UI: keep the 3 stats for the chooser
  const [stats, setStats] = useState<AllStats | null>(null);

  // ---------- map init (once) ----------
  useEffect(() => {
    if (mapRef.current || !divRef.current) return;

    // Build preferred vector style, but be ready to fall back
    let style: any;
    try {
      if (!pmtilesRegistered) {
        const protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
        pmtilesRegistered = true;
        const p = new PMTiles(PMTILES_URL);
        protocol.add(p);
        p.getHeader().catch(() => {});
      }

      style = {
        version: 8,
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
        sources: { texas: { type: "vector", url: "pmtiles://" + PMTILES_URL } },
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": COLORS.land },
          },
          {
            id: "park",
            type: "fill",
            source: "texas",
            "source-layer": "park",
            paint: { "fill-color": COLORS.greens, "fill-opacity": 0.85 },
          },
          {
            id: "water",
            type: "fill",
            source: "texas",
            "source-layer": "water",
            paint: { "fill-color": COLORS.water },
          },
          {
            id: "landuse",
            type: "fill",
            source: "texas",
            "source-layer": "landuse",
            paint: { "fill-color": COLORS.land, "fill-opacity": 0.18 },
          },
          {
            id: "bldg",
            type: "fill",
            source: "texas",
            "source-layer": "building",
            minzoom: 13,
            paint: { "fill-color": COLORS.bldg },
          },
          {
            id: "bldg-outline",
            type: "line",
            source: "texas",
            "source-layer": "building",
            minzoom: 13,
            paint: {
              "line-color": COLORS.bldgLine,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                13,
                0.2,
                16,
                0.6,
              ],
            },
          },
          {
            id: "road-hwy-casing",
            type: "line",
            source: "texas",
            "source-layer": "transportation",
            filter: [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              true,
              false,
            ],
            paint: {
              "line-color": COLORS.roadCase,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                1.8,
                10,
                3.6,
                14,
                6.5,
              ],
            },
          },
          {
            id: "road-hwy",
            type: "line",
            source: "texas",
            "source-layer": "transportation",
            filter: [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              true,
              false,
            ],
            paint: {
              "line-color": COLORS.roadHwy,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                1.2,
                10,
                2.6,
                14,
                5.0,
              ],
            },
          },
          {
            id: "road-primary",
            type: "line",
            source: "texas",
            "source-layer": "transportation",
            filter: [
              "match",
              ["get", "class"],
              ["primary", "secondary", "tertiary"],
              true,
              false,
            ],
            paint: {
              "line-color": COLORS.roadPrim,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                0.6,
                10,
                1.6,
                14,
                3.2,
              ],
            },
          },
          {
            id: "road-minor",
            type: "line",
            source: "texas",
            "source-layer": "transportation",
            filter: [
              "match",
              ["get", "class"],
              [
                "residential",
                "living_street",
                "service",
                "unclassified",
                "road",
                "track",
              ],
              true,
              false,
            ],
            paint: {
              "line-color": COLORS.roadMinor,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                0.3,
                14,
                1.6,
              ],
            },
          },
          {
            id: "boundary",
            type: "line",
            source: "texas",
            "source-layer": "boundary",
            minzoom: 4,
            paint: {
              "line-color": "#777",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                0.2,
                8,
                1.1,
              ],
              "line-dasharray": [2, 2],
            },
          },
          {
            id: "road-label",
            type: "symbol",
            source: "texas",
            "source-layer": "transportation_name",
            layout: {
              "symbol-placement": "line",
              "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                10,
                14,
                12,
              ],
              "text-font": ["Open Sans Regular"],
            },
            paint: {
              "text-color": COLORS.hwyLabel,
              "text-halo-color": COLORS.land,
              "text-halo-width": 2,
            },
          },
          {
            id: "place-label",
            type: "symbol",
            source: "texas",
            "source-layer": "place",
            layout: {
              "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
              "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 16],
              "text-font": ["Open Sans Regular"],
            },
            paint: {
              "text-color": COLORS.text,
              "text-halo-color": COLORS.land,
              "text-halo-width": 2,
            },
          },
        ],
      } as any;
    } catch {
      style = FALLBACK_STYLE_URL;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: divRef.current!,
        style,
        center: viewRef.current.center,
        zoom: viewRef.current.zoom,
        maxZoom: 19,
        attributionControl: false,
        hash: true,
        fadeDuration: 80,
        maxTileCacheSize: 2048,
        // @ts-expect-error runtime option exists
        prefetchZoomDelta: 1,
      });

      // If the vector/pmtiles style fails later, auto-fallback
      map.on("error", (e) => {
        const msg =
          (e && (e as any).error && (e as any).error.message) || String(e);
        if (/pmtiles|source.*texas|style/i.test(msg)) {
          console.warn("[map] switching to fallback style:", msg);
          map.setStyle(FALLBACK_STYLE_URL);
        }
      });
    } catch {
      // Last resort
      map = new maplibregl.Map({
        container: divRef.current!,
        style: FALLBACK_STYLE_URL,
        center: viewRef.current.center,
        zoom: viewRef.current.zoom,
        attributionControl: false,
      });
    }

    // Controls
    map.addControl(
      new maplibregl.NavigationControl({ showZoom: true, showCompass: false }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          `© OpenMapTiles © OpenStreetMap contributors · ` +
          `<a href="${INFO_URL}" target="_blank" rel="noopener" ` +
          `onclick="if(window.__HW_OPEN_INFO__){event.preventDefault();window.__HW_OPEN_INFO__();}">` +
          `About &amp; Legal</a>`,
      })
    );
    positionAttribution();

    // Ensure route layers exist whenever a style is (re)loaded
    const ensureOnStyle = () => ensureRouteLayers(map);
    map.on("load", ensureOnStyle);
    map.on("style.load", ensureOnStyle);

    // persist view after camera changes
    const persist = () => {
      const c = map.getCenter();
      const v = {
        center: [c.lng, c.lat] as [number, number],
        zoom: map.getZoom(),
      };
      viewRef.current = v;
      saveView(v);
    };
    map.on("moveend", persist);
    map.on("zoomend", persist);
    map.on("idle", persist);

    // after map is created
    map.on("contextmenu", async (e) => {
      const dest: LngLat = [e.lngLat.lng, e.lngLat.lat];
      routeDestRef.current = dest;
      upsertDestMarker(dest);

      setRevBusy(true);
      try {
        const { label } = await reverseGeocode(dest[0], dest[1], "en");
        setSearchText(label);
      } catch {
        setSearchText(
          `Dropped pin @ ${dest[1].toFixed(5)}, ${dest[0].toFixed(5)}`
        );
      } finally {
        setRevBusy(false);
      }

      const me = getMePoint();
      if (me) {
        routeReadyRef.current = false;
        computeAndRenderAllRoutes(me, dest);
        fitToMeAndDest(dest);
      }
    });

    mapRef.current = map;

    // follow is ALWAYS on — native vs web (iOS Safari needs a user tap)
    (async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Native (Android/iOS app)
          const status = await Geolocation.checkPermissions();
          let state =
            (status as any).location ??
            (status as any).coarseLocation ??
            (status as any).locationWhenInUse;
          if (state !== "granted") {
            const req = await Geolocation.requestPermissions();
            state =
              (req as any).location ??
              (req as any).coarseLocation ??
              (req as any).locationWhenInUse;
          }
          if (state === "granted") {
            await startFollowing(true);
          } else {
            console.warn("[geo] location permission not granted (native)");
          }
        } else {
          // Web (Safari/Chrome on iPhone): show a tap-to-enable if not already granted
          if (!("geolocation" in navigator)) {
            console.warn("[geo] navigator.geolocation not available");
            return;
          }

          try {
            const perms = (navigator as any).permissions
              ? await (navigator as any).permissions.query({
                  name: "geolocation" as any,
                })
              : null;

            if (perms?.state === "granted") {
              startFollowing(true);
            } else {
              // iOS Safari often needs a user gesture to show the prompt
              setNeedsLocation(true);
            }
          } catch {
            // Safari doesn't support Permissions API — require a tap
            setNeedsLocation(true);
          }
        }
      } catch (e) {
        console.warn("[geo] init error:", e);
      }
    })();

    return () => {
      map.off("load", ensureOnStyle);
      map.off("style.load", ensureOnStyle);
      map.off("moveend", persist);
      map.off("zoomend", persist);
      map.off("idle", persist);
      popupRef.current?.remove();

      // cleanup route artifacts
      safeRemoveRoutes(map);

      map.remove();
      mapRef.current = null;
    };
  }, []);

  const [, forceUIRerender] = useState(0);
  useEffect(() => {
    const update = () => {
      positionAttribution();
      forceUIRerender((x) => x + 1); // recompute overlay offsets
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    positionAttribution();
    forceUIRerender((x) => x + 1);
  }, [stats, nav]);

  useEffect(() => {
    const onResize = () => {
      if (!mapRef.current) return;
      // If we’re previewing both pins, keep them in view with the new padding.
      if (isPreviewing() && destMarkerRef.current) {
        const d = destMarkerRef.current.getLngLat();
        ensurePinsInView([d.lng, d.lat]);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (window as any).__HW_OPEN_INFO__ = openInfo;
    return () => {
      delete (window as any).__HW_OPEN_INFO__;
    };
  }, []);

  // ---------- helpers: destination + fitting ----------
  function upsertDestMarker(ll: LngLat) {
    const m = mapRef.current!;
    if (!destMarkerRef.current) {
      destMarkerRef.current = new maplibregl.Marker({ color: COLORS.heat2 })
        .setLngLat(ll)
        .addTo(m);
    } else {
      destMarkerRef.current.setLngLat(ll);
    }
  }

  function overlayOffsetsBottomLeft() {
    if (typeof window === "undefined") {
      return { left: "12px", bottom: "12px" };
    }
    const portrait = window.innerHeight > window.innerWidth;
    const bar = document.querySelector(
      'aside[aria-label="Bottom controls"]'
    ) as HTMLElement | null;

    const barH =
      bar?.getBoundingClientRect().height ??
      Math.round(window.innerHeight * 0.25);

    return {
      left: "calc(env(safe-area-inset-left, 0px) + 12px)",
      bottom: portrait
        ? `calc(${barH}px + env(safe-area-inset-bottom, 0px) + 12px)`
        : `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
    };
  }

  function positionAttribution() {
    const mapEl = mapRef.current?.getContainer();
    if (!mapEl) return;

    const corner = mapEl.querySelector(
      ".maplibregl-ctrl-bottom-right"
    ) as HTMLElement | null;
    if (!corner) return;

    const portrait = window.innerHeight > window.innerWidth;

    // Where's our bottom bar? (uses the aria-label already on BottomBar)
    const bar = document.querySelector(
      'aside[aria-label="Bottom controls"]'
    ) as HTMLElement | null;

    // If we can measure it, use real height; otherwise fall back to ~25vh
    const barH =
      bar?.getBoundingClientRect().height ??
      Math.round(window.innerHeight * 0.25);

    if (portrait) {
      corner.style.right = "calc(env(safe-area-inset-right, 0px) + 8px)";
      corner.style.bottom = `calc(${barH}px + env(safe-area-inset-bottom, 0px) + 25px)`;
      corner.style.zIndex = "60"; // stay above map, below your sheet
    } else {
      // default placement in landscape
      corner.style.right = "calc(env(safe-area-inset-right, 0px) + 8px)";
      corner.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 8px)";
      corner.style.zIndex = "";
    }
  }

  function getMePoint(): LngLat | null {
    if (meMarkerRef.current) {
      const l = meMarkerRef.current.getLngLat();
      return [l.lng, l.lat];
    }
    return lastFixRef.current ?? null;
  }

  function mapPadding() {
    // base padding around the other sides
    const BASE = 60;

    if (typeof window === "undefined") {
      return { top: BASE, right: BASE, bottom: 160, left: BASE };
    }

    const landscape = window.innerWidth >= window.innerHeight;

    // use ~25% of the relevant axis + a little cushion (matches your bar sizing)
    if (landscape) {
      const right = Math.round(window.innerWidth * 0.25) + BASE;
      return { top: BASE, right, bottom: BASE, left: BASE };
    } else {
      const bottom = Math.round(window.innerHeight * 0.25) + BASE;
      return { top: BASE, right: BASE, bottom, left: BASE };
    }
  }

  function fitToMeAndDest(dest: LngLat) {
    const m = mapRef.current!;
    const me = getMePoint();
    if (!me) {
      m.flyTo({ center: dest, zoom: 15, duration: 700 });
      return;
    }
    const b = new maplibregl.LngLatBounds(dest, dest);
    b.extend(me);
    m.fitBounds(b, {
      duration: 700,
      padding: mapPadding(),
      maxZoom: 17,
    });
  }

  // keep both pins in view while moving, without jitter
  function ensurePinsInView(dest: LngLat) {
    const m = mapRef.current!;
    const me = getMePoint();
    if (!me) return;

    const pad = mapPadding();
    const size = m.getContainer().getBoundingClientRect();
    const pxMe = m.project({ lng: me[0], lat: me[1] });
    const pxDest = m.project({ lng: dest[0], lat: dest[1] });

    const within = (p: maplibregl.PointLike) =>
      (p as any).x >= pad.left + 20 &&
      (p as any).x <= size.width - pad.right - 20 &&
      (p as any).y >= pad.top + 20 &&
      (p as any).y <= size.height - pad.bottom - 20;

    if (!within(pxMe) || !within(pxDest)) {
      fitToMeAndDest(dest);
    }
  }

  function railWidthAtZoom(z: number) {
    // 10→3.0, 14→5.0, 18→8.0
    if (z <= 10) return 3.0;
    if (z >= 18) return 8.0;
    if (z <= 14) return 3.0 + (5.0 - 3.0) * ((z - 10) / 4);
    return 5.0 + (8.0 - 5.0) * ((z - 14) / 4);
  }
  function offsetAtZoom(z: number) {
    // 10→2.2, 14→3.4, 18→5.0
    if (z <= 10) return 2.2;
    if (z >= 18) return 5.0;
    if (z <= 14) return 2.2 + (3.4 - 2.2) * ((z - 10) / 4);
    return 3.4 + (5.0 - 3.4) * ((z - 14) / 4);
  }

  // Count which routes are present overall (used for centering pairs)
  function activeKinds() {
    const r = routesRef.current;
    const a: ("fast" | "bal" | "cool")[] = [];
    if (r.fast) a.push("fast");
    if (r.bal) a.push("bal");
    if (r.cool) a.push("cool");
    return a;
  }

  // ---------- Route layer helpers (3 parallel routes) ----------
  function ensureRouteLayers(map: maplibregl.Map) {
    const addSrc = (id: string) => {
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          lineMetrics: true,
        } as any);
      }
    };

    // width scales with zoom
    const LINE_WIDTH_EXPR = [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      3.0,
      14,
      5.0,
      18,
      8.0,
    ] as any;

    // small halo around each rail
    const HALO_WIDTH_EXPR = ["+", LINE_WIDTH_EXPR, 2] as any;

    // IMPORTANT: define offset for each side explicitly (no ["*", -1, ...])
    const OFFSET_POS = [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      2.2,
      14,
      3.4,
      18,
      5.0,
    ] as any;
    const OFFSET_NEG = [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      -2.2,
      14,
      -3.4,
      18,
      -5.0,
    ] as any;

    addSrc(SRC_FAST);
    addSrc(SRC_BAL);
    addSrc(SRC_COOL);

    // --- halos first (so rails render on top) ---
    const addHalo = (id: string, srcId: string, offsetExpr: any) => {
      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: "line",
          source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": COLORS.routeHalo,
            "line-width": HALO_WIDTH_EXPR,
            "line-opacity": 0.8,
            "line-offset": offsetExpr,
          },
        });
      }
    };

    addHalo(LYR_FAST_HALO, SRC_FAST, OFFSET_NEG); // left
    addHalo(LYR_BAL_HALO, SRC_BAL, 0); // center
    addHalo(LYR_COOL_HALO, SRC_COOL, OFFSET_POS); // right

    // --- colored rails ---
    const addRail = (
      id: string,
      srcId: string,
      color: string,
      offsetExpr: any
    ) => {
      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: "line",
          source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": color,
            "line-width": LINE_WIDTH_EXPR,
            "line-opacity": 0.98,
            "line-offset": offsetExpr,
          },
        });
      }
    };

    addRail(LYR_FAST, SRC_FAST, COLORS.routeFast, OFFSET_NEG); // left
    addRail(LYR_BAL, SRC_BAL, COLORS.routeBalanced, 0); // center
    addRail(LYR_COOL, SRC_COOL, COLORS.routeCool, OFFSET_POS); // right
  }

  function setRouteGeometry(srcId: string, feature: any) {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource(srcId) as maplibregl.GeoJSONSource;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: feature ? [feature] : [],
    });
  }

  function clearAllRoutes() {
    setRouteGeometry(SRC_FAST, null as any);
    setRouteGeometry(SRC_BAL, null as any);
    setRouteGeometry(SRC_COOL, null as any);
    routeReadyRef.current = false;
  }

  function safeRemoveRoutes(map: maplibregl.Map) {
    [
      LYR_FAST,
      LYR_FAST_HALO,
      LYR_BAL,
      LYR_BAL_HALO,
      LYR_COOL,
      LYR_COOL_HALO,
    ].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    [SRC_FAST, SRC_BAL, SRC_COOL].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  }

  // hide/show helpers for routes: keep only one visible
  function showOnlyRoute(kind: "fast" | "bal" | "cool") {
    if (kind !== "fast") setRouteGeometry(SRC_FAST, null as any);
    if (kind !== "bal") setRouteGeometry(SRC_BAL, null as any);
    if (kind !== "cool") setRouteGeometry(SRC_COOL, null as any);
  }

  function startNav(kind: "fast" | "bal" | "cool") {
    const route = routesRef.current[kind];
    if (!route || !mapRef.current) return;

    // keep only the chosen line on the map
    showOnlyRoute(kind);

    // enter nav state
    setNavNow({
      profile: kind,
      route,
      stepIndex: 0,
      startedAt: Date.now(),
      offRouteSince: null,
      stepRemainingM: route.instructions?.[0]?.distance ?? route.distance, // seed
      totalRemainingM: route.distance,
    });

    // snap camera to you, top-down, tight zoom
    const here = getMePoint();
    if (here) {
      mapRef.current.easeTo({
        center: { lng: here[0], lat: here[1] },
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
        duration: 600,
      });
    } else {
      mapRef.current.easeTo({
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
        duration: 600,
      });
    }
  }

  function endNav() {
    setNavNow(null);
    clearAllRoutes();
    setStats(null);
    routeDestRef.current = null;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
  }

  // thresholds for reroute
  const OFF_ROUTE_M = 40;
  const OFF_ROUTE_SECS = 6;
  const REROUTE_COOLDOWN_MS = 12_000;
  let lastRerouteAt = 0;

  function onNavTick(here: LngLat) {
    const nav = navRef.current;
    if (!nav) return;

    // snap to current line
    const snapped = snapToLine(nav.route.geometry, here);
    const off = snapped.offDistM;

    // off-route tracking
    if (off > OFF_ROUTE_M) {
      if (!nav.offRouteSince) {
        setNavNow({ ...nav, offRouteSince: Date.now() });
      } else if (
        Date.now() - nav.offRouteSince! > OFF_ROUTE_SECS * 1000 &&
        Date.now() - lastRerouteAt > REROUTE_COOLDOWN_MS
      ) {
        lastRerouteAt = Date.now();
        const dest = nav.route.waypoints[1];
        routeBetween(here, dest, {
          ghProfile:
            nav.profile === "fast"
              ? "foot_fastest"
              : nav.profile === "bal"
              ? "foot_balanced"
              : "foot_coolest",
        })
          .then((next) => {
            routesRef.current[nav.profile] = next;
            setRouteGeometry(
              nav.profile === "fast"
                ? SRC_FAST
                : nav.profile === "bal"
                ? SRC_BAL
                : SRC_COOL,
              next.geometry
            );
            setNavNow({
              profile: nav.profile,
              route: next,
              stepIndex: 0,
              startedAt: Date.now(),
              offRouteSince: null,
            });
          })
          .catch(() => {});
      }
    } else if (nav.offRouteSince) {
      setNavNow({ ...nav, offRouteSince: null });
    }

    // step advancement + live distances
    const steps = nav.route.instructions ?? [];
    if (!steps.length) return;

    const coords = nav.route.geometry.geometry.coordinates as [
      number,
      number
    ][];
    const idx = Math.max(0, nav.stepIndex);
    const cur = steps[idx];
    if (!cur || !Array.isArray(cur.interval)) return; // safety

    const endVertex = Math.min(
      coords.length - 1,
      Math.max(0, cur.interval[1] ?? snapped.nextIndex)
    );

    // meters from snapped point to the next vertex (if it exists)
    let extra = 0;
    if (snapped.nextIndex < coords.length) {
      const nextC = coords[snapped.nextIndex];
      if (nextC) {
        const c = snapped.closest as [number, number];
        extra = Math.hypot(
          (nextC[0] - c[0]) * M_PER_DEG_LON_AT((nextC[1] + c[1]) / 2),
          (nextC[1] - c[1]) * M_PER_DEG_LAT
        );
      }
    }

    const mToEnd = Math.max(
      0,
      lengthBetween(coords, Math.min(snapped.nextIndex, endVertex), endVertex) +
        extra
    );

    const totalRemainingM = Math.max(
      0,
      (nav.route.distance ?? 0) - snapped.traveledM
    ); // push live values even if we don't change stepIndex

    // push live values even if we don't change stepIndex
    _setNav((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, stepRemainingM: mToEnd, totalRemainingM };
      navRef.current = updated;
      return updated;
    });

    if (mToEnd < 12 && idx < steps.length - 1) {
      setNavNow({ ...nav, stepIndex: idx + 1 });
    }
  }

  async function computeAndRenderAllRoutes(from: LngLat, to: LngLat) {
    try {
      const [fast, bal, cool] = await Promise.allSettled([
        routeBetween(from, to, { ghProfile: "foot_fastest" }),
        routeBetween(from, to, { ghProfile: "foot_balanced" }),
        routeBetween(from, to, { ghProfile: "foot_coolest" }), // <-- fixed typo
      ]);

      // update map geometries
      if (fast.status === "fulfilled") {
        setRouteGeometry(SRC_FAST, fast.value.geometry);
        routesRef.current.fast = fast.value;
      } else {
        console.warn("[route fast] fallback:", fast.reason);
        setRouteGeometry(SRC_FAST, lineFeature(from, to));
        delete routesRef.current.fast;
      }
      if (bal.status === "fulfilled") {
        routesRef.current.bal = bal.value;
        setRouteGeometry(SRC_BAL, bal.value.geometry);
      } else {
        console.warn("[route balanced] fallback:", bal.reason);
        setRouteGeometry(SRC_BAL, lineFeature(from, to));
        delete routesRef.current.bal;
      }
      if (cool.status === "fulfilled") {
        setRouteGeometry(SRC_COOL, cool.value.geometry);
        routesRef.current.cool = cool.value;
      } else {
        console.warn("[route cool] fallback:", cool.reason);
        setRouteGeometry(SRC_COOL, lineFeature(from, to));
        delete routesRef.current.cool;
      }

      // Build stats for the UI
      const next: AllStats = {};
      let any = false;

      if (fast.status === "fulfilled") {
        next.fast = {
          durationSec: fast.value.duration,
          distanceM: fast.value.distance,
        };
        any = true;
      }
      if (bal.status === "fulfilled") {
        next.bal = {
          durationSec: bal.value.duration,
          distanceM: bal.value.distance,
        };
        any = true;
      }
      if (cool.status === "fulfilled") {
        next.cool = {
          durationSec: cool.value.duration,
          distanceM: cool.value.distance,
        };
        any = true;
      }

      setStats(any ? next : null);
      routeReadyRef.current = true;
    } catch (err) {
      console.warn("[routes] all failed, drawing straight lines:", err);
      setRouteGeometry(SRC_FAST, lineFeature(from, to));
      setRouteGeometry(SRC_BAL, lineFeature(from, to));
      setRouteGeometry(SRC_COOL, lineFeature(from, to));
      setStats(null);
      routeReadyRef.current = true;
    }
  }

  // Are we previewing routes (dest picked) but not actively navigating?
  function isPreviewing() {
    return !!routeDestRef.current && !navRef.current;
  }

  // ---------- follow mode (always on) ----------
  async function startFollowing(zoomOnFirstFix = false) {
    const m = mapRef.current!;
    let gotFirstFix = false;
    let lastForRecenter: LngLat | null = null;

    const onPosition = (pos: {
      coords: { latitude: number; longitude: number };
    }) => {
      const here: LngLat = [pos.coords.longitude, pos.coords.latitude];

      if (!meMarkerRef.current) {
        meMarkerRef.current = new maplibregl.Marker({ color: COLORS.coolPin })
          .setLngLat(here)
          .addTo(m);
      } else {
        meMarkerRef.current.setLngLat(here);
      }

      // update nav computations first
      onNavTick(here);
      lastFixRef.current = here;

      if (routeDestRef.current && !routeReadyRef.current) {
        computeAndRenderAllRoutes(here, routeDestRef.current);
      }

      // Camera behavior
      const navCur = navRef.current;

      if (navCur && mapRef.current) {
        const snapped = snapToLine(navCur.route.geometry, here);
        const coords = navCur.route.geometry.geometry.coordinates as [
          number,
          number
        ][];
        const ahead = coords[Math.min(coords.length - 1, snapped.nextIndex)];
        const brg = ahead
          ? bearingDeg(here, ahead)
          : mapRef.current.getBearing();

        mapRef.current.easeTo({
          center: here,
          zoom: NAV_ZOOM,
          pitch: NAV_PITCH,
          bearing: brg,
          duration: 400,
        });
      } else if (isPreviewing() && mapRef.current) {
        const d = destMarkerRef.current!.getLngLat();
        ensurePinsInView([d.lng, d.lat]);
        return;
      } else {
        if (destMarkerRef.current) {
          const d = destMarkerRef.current.getLngLat();
          ensurePinsInView([d.lng, d.lat]);
          return;
        }

        if (!gotFirstFix) {
          gotFirstFix = true;
          const z = Math.max(15, m.getZoom());
          m.easeTo({
            center: here,
            zoom: zoomOnFirstFix ? z : m.getZoom(),
            duration: 600,
          });
          lastForRecenter = here;
          return;
        }

        if (!lastForRecenter || distMeters(lastForRecenter, here) >= 3) {
          m.easeTo({
            center: here,
            duration: 400,
            bearing: m.getBearing(),
            pitch: m.getPitch(),
          });
          lastForRecenter = here;
        }
      }
    };

    const onError = (err: any) => {
      console.warn("[geo] watch error:", err?.code, err?.message ?? err);
      // If user denied, surface the button on web
      if (!Capacitor.isNativePlatform()) setNeedsLocation(true);
    };

    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

    if (Capacitor.isNativePlatform()) {
      await Geolocation.watchPosition(options as any, (pos, err) => {
        if (err || !pos) return onError(err);
        onPosition(pos as any);
      });
    } else {
      // Web watcher
      navigator.geolocation.watchPosition(onPosition, onError, options);
    }
  }
  // ---------- called by SearchBox ----------
  const goToHit = (hit: {
    center: LngLat;
    bbox?: [number, number, number, number];
  }) => {
    const m = mapRef.current;
    if (!m) return;

    const dest = hit.center;
    routeDestRef.current = dest; // remember for later renders
    routeReadyRef.current = false; // force recompute on new dest
    upsertDestMarker(dest);

    const me = getMePoint();
    if (me) {
      computeAndRenderAllRoutes(me, dest);
    } else {
      // We'll compute once we get the next GPS fix
      clearAllRoutes();
      setStats(null);
    }

    // Fit both pins, then zoom out ~10% for a nicer chooser view
    fitToMeAndDest(dest);
    // After bounds fit, ensure preview is north-up & a touch more zoomed out
    m.once("moveend", () => {
      // still in preview (no active nav)?
      if (!navRef.current) {
        m.easeTo({
          zoom: Math.max(0, m.getZoom() - PICKER_ZOOMOUT_DELTA), // ~10% more zoomed out
          bearing: 0,
          pitch: NAV_PITCH,
          duration: 300,
        });
      }
    });
  };

  const metrics = navRef.current
    ? {
        ...(navRef.current.stepRemainingM != null
          ? { stepRemainingM: navRef.current.stepRemainingM }
          : {}),
        ...(navRef.current.totalRemainingM != null
          ? { totalRemainingM: navRef.current.totalRemainingM }
          : {}),
      }
    : {};

  // ---------- render ----------
  return (
    <div className="relative w-full h-screen">
      {/* Web-only “Enable location” chip (iOS Safari often needs a tap) */}
      {!Capacitor.isNativePlatform() && needsLocation && (
        <button
          onClick={requestLocation}
          style={overlayOffsetsBottomLeft()}
          className="absolute z-[70] rounded-xl bg-[#5c0f14] text-white px-3 py-2 shadow
               focus:outline-none focus:ring-2 focus:ring-[#b44427]"
          aria-label="Enable location"
        >
          Enable location
        </button>
      )}
      {/* Map */}
      <div ref={divRef} className="w-full h-full" />

      {/* Bottom bar (search + route chooser) */}
      <BottomBar>
        <div className="w-full">
          {navRef.current ? (
            <NavPanel
              route={navRef.current.route}
              stepIndex={navRef.current.stepIndex}
              startedAt={navRef.current.startedAt}
              {...metrics}
              onEnd={endNav}
            />
          ) : (
            <>
              <SearchBox
                biasCenter={() => viewRef.current.center}
                onPick={goToHit}
                value={searchText}
                onValueChange={setSearchText}
                busy={revBusy} // 👈 NEW
              />

              {stats && (
                <div className="mt-3 flex flex-col gap-2">
                  {/* FASTEST */}
                  <div
                    className="group flex items-center justify-between gap-3 rounded-xl
                    ring-1 ring-[#5c0f14]/10 bg-[#fffaf3] hover:bg-[#fff6ea]
                    px-3 py-2 shadow-[0_1px_0_#ffffff_inset,0_2px_10px_rgba(92,15,20,0.10)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-7 w-1.5 rounded-full"
                        style={{
                          backgroundColor: COLORS.routeFast,
                          opacity: 0.9,
                        }}
                      />
                      <span className="text-sm font-medium text-[#3a2b24]">
                        Fastest
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-[#4a4039]">
                        {fmtDurationHM(
                          stats.fast?.durationSec,
                          stats.fast?.distanceM
                        )}{" "}
                        · {fmtMiles(stats.fast?.distanceM)}
                      </span>
                      <button
                        className="rounded-lg bg-[#5c0f14] hover:bg-[#451016] text-white px-3 py-2
                     shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_6px_rgba(92,15,20,0.25)]
                     focus:outline-none focus:ring-2 focus:ring-offset-2
                     focus:ring-[#b44427] focus:ring-offset-[#f3ece4]"
                        onClick={() => startNav("fast")}
                      >
                        Start
                      </button>
                    </div>
                  </div>

                  {/* BALANCED */}
                  <div
                    className="group flex items-center justify-between gap-3 rounded-xl
                    ring-1 ring-[#5c0f14]/10 bg-[#fffaf3] hover:bg-[#fff6ea]
                    px-3 py-2 shadow-[0_1px_0_#ffffff_inset,0_2px_10px_rgba(92,15,20,0.10)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-7 w-1.5 rounded-full"
                        style={{
                          backgroundColor: COLORS.routeBalanced,
                          opacity: 0.9,
                        }}
                      />
                      <span className="text-sm font-medium text-[#3a2b24]">
                        Balanced
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-[#4a4039]">
                        {fmtDurationHM(
                          stats.bal?.durationSec,
                          stats.bal?.distanceM
                        )}{" "}
                        · {fmtMiles(stats.bal?.distanceM)}
                      </span>
                      <button
                        className="rounded-lg bg-[#5c0f14] hover:bg-[#451016] text-white px-3 py-2
                     shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_6px_rgba(92,15,20,0.25)]
                     focus:outline-none focus:ring-2 focus:ring-offset-2
                     focus:ring-[#b44427] focus:ring-offset-[#f3ece4]"
                        onClick={() => startNav("bal")}
                      >
                        Start
                      </button>
                    </div>
                  </div>

                  {/* COOLEST */}
                  <div
                    className="group flex items-center justify-between gap-3 rounded-xl
                    ring-1 ring-[#5c0f14]/10 bg-[#fffaf3] hover:bg-[#fff6ea]
                    px-3 py-2 shadow-[0_1px_0_#ffffff_inset,0_2px_10px_rgba(92,15,20,0.10)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-7 w-1.5 rounded-full"
                        style={{
                          backgroundColor: COLORS.routeCool,
                          opacity: 0.9,
                        }}
                      />
                      <span className="text-sm font-medium text-[#3a2b24]">
                        Coolest
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-[#4a4039]">
                        {fmtDurationHM(
                          stats.cool?.durationSec,
                          stats.cool?.distanceM
                        )}{" "}
                        · {fmtMiles(stats.cool?.distanceM)}
                      </span>
                      <button
                        className="rounded-lg bg-[#5c0f14] hover:bg-[#451016] text-white px-3 py-2
                     shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_6px_rgba(92,15,20,0.25)]
                     focus:outline-none focus:ring-2 focus:ring-offset-2
                     focus:ring-[#b44427] focus:ring-offset-[#f3ece4]"
                        onClick={() => startNav("cool")}
                      >
                        Start
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
