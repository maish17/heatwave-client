import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol, PMTiles } from "pmtiles";

let pmtilesRegistered = false;
const PMTILES_URL =
  "https://pub-e283a056eec14b7c97747e17f8728eed.r2.dev/texas.pmtiles?v=dev3";

// Heatwave palette tokens
const COLORS = {
  bg: "#E6D2BC",
  text: "#1B1E22",
  heat1: "#DA8A2F",
  heat2: "#B44427",
  heat3: "#6E1519",
  cool: "#1FB5AD",
  land: "#E6D2BC",
  water: "#DCECEF",
  greens: "#D9D3BD",
  bldg: "#E9D8C6",
  bldgLine: "#CDB79E",
  roadMinor: "#E8DACB",
  roadPrim: "#D7C1A8",
  roadHwy: "#C9AB89",
  roadCase: "#B69372",
  hwyLabel: "#3D322B",
};

export default function MapView() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (mapRef.current || !divRef.current) return;

    // Register pmtiles protocol once
    if (!pmtilesRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      pmtilesRegistered = true;

      // Optional warm header (debug)
      const p = new PMTiles(PMTILES_URL);
      protocol.add(p);
      p.getHeader()
        .then((h) => console.log("[PMTiles] header:", h))
        .catch((e) => console.error("[PMTiles] header error:", e));
    }

    const style = {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        texas: {
          type: "vector",
          url: "pmtiles://" + PMTILES_URL,
        },
      },
      layers: [
        // Canvas background = land tone
        {
          id: "bg",
          type: "background",
          paint: { "background-color": COLORS.land },
        },

        // Water + greens
        {
          id: "water",
          type: "fill",
          source: "texas",
          "source-layer": "water",
          paint: { "fill-color": COLORS.water },
        },
        {
          id: "park",
          type: "fill",
          source: "texas",
          "source-layer": "park",
          paint: { "fill-color": COLORS.greens, "fill-opacity": 0.85 },
        },
        {
          id: "landuse",
          type: "fill",
          source: "texas",
          "source-layer": "landuse",
          paint: { "fill-color": COLORS.land, "fill-opacity": 0.18 },
        },

        // Buildings
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

        // Roads (casing then fill)
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

        // Boundaries
        {
          id: "boundary",
          type: "line",
          source: "texas",
          "source-layer": "boundary",
          minzoom: 4,
          paint: {
            "line-color": "#777",
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 1.1],
            "line-dasharray": [2, 2],
          },
        },

        // Road labels (default font — omit text-font)
        {
          id: "road-label",
          type: "symbol",
          source: "texas",
          "source-layer": "transportation_name",
          layout: {
            "symbol-placement": "line",
            "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
            "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 12],
          },
          paint: {
            "text-color": COLORS.hwyLabel,
            "text-halo-color": COLORS.land,
            "text-halo-width": 2,
          },
        },

        // Place labels (default font — omit text-font)
        {
          id: "place-label",
          type: "symbol",
          source: "texas",
          "source-layer": "place",
          layout: {
            "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
            "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 16],
          },
          paint: {
            "text-color": COLORS.text,
            "text-halo-color": COLORS.land,
            "text-halo-width": 2,
          },
        },
      ],
    } as any;

    const map = new maplibregl.Map({
      container: divRef.current,
      style,
      center: [-99.965735, 31.09691],
      zoom: 5,
      maxZoom: 19,
      attributionControl: false, // ← turn off the built-in one
    });

    // Debug grid OFF
    (map as any).showTileBoundaries = false;

    // Optional logs
    map.on("load", () => console.log("[MapLibre] load"));
    map.on("styledata", () => console.log("[MapLibre] styledata"));
    map.on("sourcedata", (e: any) => {
      if (e.sourceId === "texas") {
        console.log("[MapLibre] sourcedata:", {
          sourceId: e.sourceId,
          type: e.sourceDataType,
          tileId: e.tile?.tileID,
          isSourceLoaded: map.isSourceLoaded("texas"),
        });
      }
    });
    map.on("error", (e) => console.error("[MapLibre] error:", e?.error || e));

    // Controls
    const nav = new maplibregl.NavigationControl({
      showZoom: false, // bring back +/–
      showCompass: true, // round compass
      visualizePitch: false, // set to true if you also want the ▲▼ pitch button
    });
    map.addControl(nav, "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "© OpenMapTiles © OpenStreetMap contributors",
      })
    );

    mapRef.current = map;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={divRef} className="w-full h-screen" />;
}
