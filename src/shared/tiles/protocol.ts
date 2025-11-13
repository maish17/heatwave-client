import maplibregl from "maplibre-gl";
import { Protocol, PMTiles } from "pmtiles";

let protocol: Protocol | null = null;
const registered = { value: false };
const added = new Set<string>();

export async function ensurePmtilesFor(url: string): Promise<void> {
  if (!protocol) protocol = new Protocol();
  if (!registered.value) {
    maplibregl.addProtocol("pmtiles", protocol!.tile);
    registered.value = true;
  }
  if (!added.has(url)) {
    const p = new PMTiles(url);
    protocol.add(p);
    try {
      await p.getHeader();
    } catch {}
    added.add(url);
  }
}
