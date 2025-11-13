export function getTilesUrl(): string {
  return (
    import.meta.env.VITE_TILES_URL ??
    "https://tiles.heatwaves.app/texas.pmtiles"
  );
}
