export function makePmtilesVectorSource(id: string, url: string) {
  return { id, type: "vector", url: `pmtiles://${url}` };
}
