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

let pmtilesRegistered = false;

// Your vector tiles (preferred)
const PMTILES_URL =
  "https://pub-e283a056eec14b7c97747e17f8728eed.r2.dev/texas.pmtiles?v=dev3";

// Guaranteed-safe fallback style so the map always renders
const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

const COLORS = {
  bg: "#E6D2BC",
  text: "#1B1E22",
  heat2: "#B44427", // destination pin
  coolPin: "#1FB5AD", // me pin
  land: "#E6D2BC",
  water: "#EFE8DC",
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
  routeFast: "#D0532B", // warmest
  routeBalanced: "#0d6e69", // mid
  routeCool: "#1FB5AD", // coolest
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
        customAttribution: "© OpenMapTiles © OpenStreetMap contributors",
      })
    );

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

    // reverse geocode on click
    map.on("click", async (e) => {
      try {
        const { label } = await reverseGeocode(
          e.lngLat.lng,
          e.lngLat.lat,
          "en"
        );
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeOnMove: true })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="max-width:260px">${escapeHtml(label)}</div>`)
          .addTo(map);
      } catch (err) {
        console.warn("[reverse] failed:", err);
      }
    });

    mapRef.current = map;

    // follow is ALWAYS on
    (async () => {
      try {
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
          console.warn("[geo] location permission not granted");
        }
      } catch (e) {
        console.warn("[geo] permission error:", e);
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

  function getMePoint(): LngLat | null {
    if (meMarkerRef.current) {
      const l = meMarkerRef.current.getLngLat();
      return [l.lng, l.lat];
    }
    return lastFixRef.current ?? null;
  }

  function bottomPaddingPx() {
    if (typeof window === "undefined") return 160;
    return Math.round(window.innerHeight * 0.25) + 60; // 25% bar + cushion
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
      padding: { top: 60, right: 60, bottom: bottomPaddingPx(), left: 60 },
      maxZoom: 17,
    });
  }

  // keep both pins in view while moving, without jitter
  function ensurePinsInView(dest: LngLat) {
    const m = mapRef.current!;
    const me = getMePoint();
    if (!me) return;

    const pad = { top: 60, right: 60, bottom: bottomPaddingPx(), left: 60 };
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
    const addLinePair = (
      haloId: string,
      lineId: string,
      srcId: string,
      color: string
    ) => {
      if (!map.getLayer(haloId)) {
        map.addLayer({
          id: haloId,
          type: "line",
          source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": COLORS.routeHalo,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              5.0,
              14,
              8.0,
              18,
              12.0,
            ],
            "line-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": color,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              3.0,
              14,
              5.0,
              18,
              8.0,
            ],
            "line-opacity": 0.95,
          },
        });
      }
    };

    addSrc(SRC_FAST);
    addSrc(SRC_BAL);
    addSrc(SRC_COOL);

    // Draw order: halo then line, and put "cool" on top so it stays visible
    addLinePair(LYR_FAST_HALO, LYR_FAST, SRC_FAST, COLORS.routeFast);
    addLinePair(LYR_BAL_HALO, LYR_BAL, SRC_BAL, COLORS.routeBalanced);
    addLinePair(LYR_COOL_HALO, LYR_COOL, SRC_COOL, COLORS.routeCool);
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
      } else {
        console.warn("[route fast] fallback:", fast.reason);
        setRouteGeometry(SRC_FAST, lineFeature(from, to));
      }
      if (bal.status === "fulfilled") {
        setRouteGeometry(SRC_BAL, bal.value.geometry);
      } else {
        console.warn("[route balanced] fallback:", bal.reason);
        setRouteGeometry(SRC_BAL, lineFeature(from, to));
      }
      if (cool.status === "fulfilled") {
        setRouteGeometry(SRC_COOL, cool.value.geometry);
      } else {
        console.warn("[route cool] fallback:", cool.reason);
        setRouteGeometry(SRC_COOL, lineFeature(from, to));
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

  // ---------- follow mode (always on) ----------
  async function startFollowing(zoomOnFirstFix = false) {
    const m = mapRef.current!;
    let gotFirstFix = false;
    let lastForRecenter: LngLat | null = null;

    await Geolocation.watchPosition(
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      (pos, err) => {
        if (err || !pos) return;
        const here: LngLat = [pos.coords.longitude, pos.coords.latitude];

        if (!meMarkerRef.current) {
          meMarkerRef.current = new maplibregl.Marker({ color: COLORS.coolPin })
            .setLngLat(here)
            .addTo(m);
        } else {
          meMarkerRef.current.setLngLat(here);
        }
        lastFixRef.current = here;

        if (routeDestRef.current && !routeReadyRef.current) {
          computeAndRenderAllRoutes(here, routeDestRef.current);
        }

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
    );
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

    fitToMeAndDest(dest);
  };

  // ---------- render ----------
  return (
    <div className="relative w-full h-screen">
      {/* Map */}
      <div ref={divRef} className="w-full h-full" />

      {/* Bottom bar (search + route chooser) */}
      <BottomBar>
        <div className="w-full">
          <SearchBox
            biasCenter={() => viewRef.current.center}
            onPick={goToHit}
          />

          {/* 3-option route chooser (hidden until a place is selected) */}
          {stats && (
            <div className="mt-3 flex flex-col gap-2">
              {/* FASTEST */}
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/90 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS.routeFast }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Fastest
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-gray-700">
                    {fmtDurationHM(
                      stats.fast?.durationSec,
                      stats.fast?.distanceM
                    )}{" "}
                    · {fmtMiles(stats.fast?.distanceM)}
                  </span>
                  <button
                    className="rounded-lg bg-black/80 px-3 py-1 text-sm text-white hover:bg-black"
                    onClick={() => console.log("select fastest")}
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* BALANCED */}
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/90 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS.routeBalanced }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Balanced
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-gray-700">
                    {fmtDurationHM(
                      stats.bal?.durationSec,
                      stats.bal?.distanceM
                    )}{" "}
                    · {fmtMiles(stats.bal?.distanceM)}
                  </span>
                  <button
                    className="rounded-lg bg-black/80 px-3 py-1 text-sm text-white hover:bg-black"
                    onClick={() => console.log("select balanced")}
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* COOLEST */}
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/90 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS.routeCool }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Coolest
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-gray-700">
                    {fmtDurationHM(
                      stats.cool?.durationSec,
                      stats.cool?.distanceM
                    )}{" "}
                    · {fmtMiles(stats.cool?.distanceM)}
                  </span>
                  <button
                    className="rounded-lg bg-black/80 px-3 py-1 text-sm text-white hover:bg-black"
                    onClick={() => console.log("select coolest")}
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
