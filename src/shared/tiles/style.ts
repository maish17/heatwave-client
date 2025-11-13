// src/shared/tiles/style.ts
import type {
  Map as MapLibreMap,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";

/** Minimal vector source reference returned by makePmtilesVectorSource */
export type VectorRef = {
  id: string;
  type: "vector";
  url: string;
};

/** Color palette used by the base style */
export type BaseColors = {
  land: string;
  water: string;
  greens: string;
  bldg: string;
  bldgLine: string;
  roadMinor: string;
  roadPrim: string;
  roadHwy: string;
  roadCase: string;
  hwyLabel: string;

  // route colors (used elsewhere, but kept here for one palette)
  routeHalo: string;
  routeFast: string;
  routeBalanced: string;
  routeCool: string;
};

export const DEFAULT_GLYPHS_URL =
  "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";

/**
 * Build just the base layers targeting a single vector source.
 * (This is what used to be inlined inside MapView.)
 */
export function buildBaseLayers(
  sourceId: string,
  COLORS: BaseColors
): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    {
      id: "bg",
      type: "background",
      paint: { "background-color": COLORS.land },
    },

    // Parks / landuse / water
    {
      id: "park",
      type: "fill",
      source: sourceId,
      "source-layer": "park",
      paint: { "fill-color": COLORS.greens, "fill-opacity": 0.85 },
    },
    {
      id: "water",
      type: "fill",
      source: sourceId,
      "source-layer": "water",
      paint: { "fill-color": COLORS.water },
    },
    {
      id: "landuse",
      type: "fill",
      source: sourceId,
      "source-layer": "landuse",
      paint: { "fill-color": COLORS.land, "fill-opacity": 0.18 },
    },

    // Buildings
    {
      id: "bldg",
      type: "fill",
      source: sourceId,
      "source-layer": "building",
      minzoom: 13,
      paint: { "fill-color": COLORS.bldg },
    },
    {
      id: "bldg-outline",
      type: "line",
      source: sourceId,
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "line-color": COLORS.bldgLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 16, 0.6],
      },
    },

    // Roads (highway casing, highway fill, primary+minor)
    {
      id: "road-hwy-casing",
      type: "line",
      source: sourceId,
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["motorway", "trunk"], true, false],
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
      source: sourceId,
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["motorway", "trunk"], true, false],
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
      source: sourceId,
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
      source: sourceId,
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 14, 1.6],
      },
    },

    // Boundaries
    {
      id: "boundary",
      type: "line",
      source: sourceId,
      "source-layer": "boundary",
      minzoom: 4,
      paint: {
        "line-color": "#777",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 1.1],
        "line-dasharray": [2, 2],
      },
    },

    // Labels: road names
    {
      id: "road-label",
      type: "symbol",
      source: sourceId,
      "source-layer": "transportation_name",
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 12],
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": COLORS.hwyLabel,
        "text-halo-color": COLORS.land,
        "text-halo-width": 2,
      },
    },

    // Labels: places
    {
      id: "place-label",
      type: "symbol",
      source: sourceId,
      "source-layer": "place",
      layout: {
        "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 16],
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#1B1E22",
        "text-halo-color": COLORS.land,
        "text-halo-width": 2,
      },
    },
  ];

  return layers;
}

/**
 * Build a full MapLibre style JSON using the vector source ref and colors.
 */
export function makeBaseStyle(
  vector: VectorRef,
  COLORS: BaseColors,
  glyphs: string = DEFAULT_GLYPHS_URL
): StyleSpecification {
  return {
    version: 8,
    glyphs,
    sources: {
      [vector.id]: {
        type: vector.type,
        url: vector.url,
      },
    },
    layers: buildBaseLayers(vector.id, COLORS),
  } as StyleSpecification;
}

/**
 * One-shot notifier when a specific vector source is fully loaded.
 */
export function onSourceLoaded(
  map: MapLibreMap,
  sourceId: string,
  cb: () => void
) {
  // Fast-path if available
  try {
    if ((map as any).isSourceLoaded?.(sourceId)) {
      cb();
      return;
    }
  } catch {
    /* noop */
  }

  const handler = (e: any) => {
    if (e?.sourceId === sourceId) {
      try {
        if ((map as any).isSourceLoaded?.(sourceId)) {
          map.off("sourcedata", handler);
          cb();
        }
      } catch {
        map.off("sourcedata", handler);
        cb();
      }
    }
  };

  map.on("sourcedata", handler);
}

/**
 * Apply a style (JSON or URL) and automatically fall back to a URL if it errors.
 */
export function applyStyleWithFallback(
  map: MapLibreMap,
  primary: StyleSpecification | string,
  fallbackStyleUrl: string
) {
  try {
    map.setStyle(primary as any);

    const onErr = (e: any) => {
      const msg = String(e?.error?.message || e?.message || e || "");
      if (/pmtiles|source.*load|style/i.test(msg)) {
        console.warn("[tiles] falling back to:", fallbackStyleUrl, "-", msg);
        map.off("error", onErr as any);
        map.setStyle(fallbackStyleUrl);
      }
    };
    map.on("error", onErr as any);
  } catch (e) {
    console.warn("[tiles] style apply failed, falling back:", e);
    map.setStyle(fallbackStyleUrl);
  }
}
