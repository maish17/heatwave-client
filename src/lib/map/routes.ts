import type maplibregl from "maplibre-gl";
import { COLORS } from "./colors";

export const SRC_FAST = "hw-route-fast-src";
export const SRC_BAL = "hw-route-bal-src";
export const SRC_COOL = "hw-route-cool-src";

export const LYR_FAST_HALO = "hw-route-fast-halo";
export const LYR_FAST = "hw-route-fast";
export const LYR_BAL_HALO = "hw-route-bal-halo";
export const LYR_BAL = "hw-route-bal";
export const LYR_COOL_HALO = "hw-route-cool-halo";
export const LYR_COOL = "hw-route-cool";

export function ensureRouteLayers(map: maplibregl.Map) {
  const addSrc = (id: string) => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        lineMetrics: true,
      } as any);
    }
  };

  const LINE_WIDTH_EXPR: any = [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    3.0,
    14,
    5.0,
    18,
    8.0,
  ];
  const HALO_WIDTH_EXPR: any = ["+", LINE_WIDTH_EXPR, 2];

  const OFFSET_POS: any = [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    2.2,
    14,
    3.4,
    18,
    5.0,
  ];
  const OFFSET_NEG: any = [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    -2.2,
    14,
    -3.4,
    18,
    -5.0,
  ];

  addSrc(SRC_FAST);
  addSrc(SRC_BAL);
  addSrc(SRC_COOL);

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

  addHalo(LYR_FAST_HALO, SRC_FAST, OFFSET_NEG);
  addHalo(LYR_BAL_HALO, SRC_BAL, 0);
  addHalo(LYR_COOL_HALO, SRC_COOL, OFFSET_POS);

  addRail(LYR_FAST, SRC_FAST, COLORS.routeFast, OFFSET_NEG);
  addRail(LYR_BAL, SRC_BAL, COLORS.routeBalanced, 0);
  addRail(LYR_COOL, SRC_COOL, COLORS.routeCool, OFFSET_POS);
}

export function setRouteGeometry(
  map: maplibregl.Map,
  srcId: string,
  feature: any
) {
  const src = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: feature ? [feature] : [],
  });
}

export function clearAllRoutes(map: maplibregl.Map) {
  setRouteGeometry(map, SRC_FAST, null as any);
  setRouteGeometry(map, SRC_BAL, null as any);
  setRouteGeometry(map, SRC_COOL, null as any);
}

export function safeRemoveRoutes(map: maplibregl.Map) {
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

export function showOnlyRoute(
  map: maplibregl.Map,
  kind: "fast" | "bal" | "cool"
) {
  if (kind !== "fast") setRouteGeometry(map, SRC_FAST, null as any);
  if (kind !== "bal") setRouteGeometry(map, SRC_BAL, null as any);
  if (kind !== "cool") setRouteGeometry(map, SRC_COOL, null as any);
}
