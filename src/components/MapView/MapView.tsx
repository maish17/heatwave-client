import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";

// avoid re-registering the protocol during HMR
let pmtilesRegistered = false;

export default function MapView() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (mapRef.current) return; // guard: don't init twice (StrictMode/HMR)

    if (!pmtilesRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      pmtilesRegistered = true;
    }

    if (!divRef.current) return;

    const map = new maplibregl.Map({
      container: divRef.current!,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf", // ← add this
        sources: {
          texas: {
            type: "vector",
            url: "pmtiles://https://pub-e283a056eec14b7c97747e17f8728eed.r2.dev/texas.pmtiles",
          },
        },
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": "#d8c5ad" },
          },
          {
            id: "water",
            type: "fill",
            source: "texas",
            "source-layer": "water",
            paint: { "fill-color": "#a6d5e8" },
          },
          {
            id: "landuse",
            type: "fill",
            source: "texas",
            "source-layer": "landuse",
            paint: { "fill-color": "#e7e2d3", "fill-opacity": 0.35 },
          },
          {
            id: "park",
            type: "fill",
            source: "texas",
            "source-layer": "park",
            paint: { "fill-color": "#cfe7c8", "fill-opacity": 0.6 },
          },
          {
            id: "boundary",
            type: "line",
            source: "texas",
            "source-layer": "boundary",
            paint: { "line-color": "#666", "line-width": 1 },
          },
          {
            id: "road",
            type: "line",
            source: "texas",
            "source-layer": "transportation",
            paint: {
              "line-color": "#c46a1f",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                0.2,
                10,
                1,
                14,
                2.5,
              ],
            },
          },
          {
            id: "place-label",
            type: "symbol",
            source: "texas",
            "source-layer": "place",
            layout: {
              "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
              "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14],
            },
            paint: {
              "text-color": "#1b1e22",
              "text-halo-color": "#fff",
              "text-halo-width": 1.2,
            },
          },
        ],
      },
      center: [-99.965735, 31.09691],
      zoom: 5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", (e) => console.error("Map error:", e.error));

    mapRef.current = map;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // If your Navbar takes vertical space, consider h-[calc(100vh-<navbarHeight>)]
  return <div ref={divRef} className="w-full h-screen" />;
}
