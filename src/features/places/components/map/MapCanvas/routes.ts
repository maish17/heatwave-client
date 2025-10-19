import maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";
type RouteFeature = GeoJSON.Feature<GeoJSON.LineString>;

export const SRC_FAST = "route-fast";
export const SRC_BAL = "route-bal";
export const SRC_COOL = "route-cool";

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

const HALO_WIDTH_EXPR = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  5.0,
  14,
  7.0,
  18,
  10.0,
] as any;

const OFFSET_POS = 2;
const OFFSET_NEG = -2;

function ensureRouteLayers(map: Map) {
  if (!map.getSource(SRC_FAST)) {
    map.addSource(SRC_FAST, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SRC_BAL)) {
    map.addSource(SRC_BAL, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SRC_COOL)) {
    map.addSource(SRC_COOL, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("route-fast-halo")) {
    map.addLayer({
      id: "route-fast-halo",
      type: "line",
      source: SRC_FAST,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f00",
        "line-width": HALO_WIDTH_EXPR,
        "line-opacity": 0.7,
      },
    });
  }
  if (!map.getLayer("route-fast")) {
    map.addLayer({
      id: "route-fast",
      type: "line",
      source: SRC_FAST,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f88",
        "line-width": LINE_WIDTH_EXPR,
      },
    });
  }
  if (!map.getLayer("route-bal-halo")) {
    map.addLayer({
      id: "route-bal-halo",
      type: "line",
      source: SRC_BAL,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#0a0",
        "line-width": HALO_WIDTH_EXPR,
        "line-opacity": 0.7,
      },
    });
  }
  if (!map.getLayer("route-bal")) {
    map.addLayer({
      id: "route-bal",
      type: "line",
      source: SRC_BAL,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#8f8",
        "line-width": LINE_WIDTH_EXPR,
      },
    });
  }
  if (!map.getLayer("route-cool-halo")) {
    map.addLayer({
      id: "route-cool-halo",
      type: "line",
      source: SRC_COOL,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#00f",
        "line-width": HALO_WIDTH_EXPR,
        "line-opacity": 0.7,
      },
    });
  }
  if (!map.getLayer("route-cool")) {
    map.addLayer({
      id: "route-cool",
      type: "line",
      source: SRC_COOL,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#88f",
        "line-width": LINE_WIDTH_EXPR,
      },
    });
  }
}

function setRouteGeometry(
  map: Map,
  srcId: string,
  feature: RouteFeature | null
): void {
  const source = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  if (!feature) {
    source.setData({ type: "FeatureCollection", features: [] });
  } else {
    source.setData(feature);
  }
}

function clearAllRoutes(map: Map) {
  setRouteGeometry(map, SRC_FAST, null);
  setRouteGeometry(map, SRC_BAL, null);
  setRouteGeometry(map, SRC_COOL, null);
}

function showOnlyRoute(map: Map, kind: "fast" | "bal" | "cool") {
  const kinds = ["fast", "bal", "cool"] as const;
  kinds.forEach((k) => {
    const visible = k === kind ? "visible" : "none";
    const haloId = `route-${k}-halo`;
    const lineId = `route-${k}`;
    if (map.getLayer(haloId))
      map.setLayoutProperty(haloId, "visibility", visible);
    if (map.getLayer(lineId))
      map.setLayoutProperty(lineId, "visibility", visible);
  });
}

function safeRemoveRoutes(map: Map) {
  const layers = [
    "route-fast-halo",
    "route-fast",
    "route-bal-halo",
    "route-bal",
    "route-cool-halo",
    "route-cool",
  ];
  layers.forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  [SRC_FAST, SRC_BAL, SRC_COOL].forEach((src) => {
    if (map.getSource(src)) {
      map.removeSource(src);
    }
  });
}

export {
  ensureRouteLayers,
  setRouteGeometry,
  clearAllRoutes,
  showOnlyRoute,
  safeRemoveRoutes,
};
