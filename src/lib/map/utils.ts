export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ((
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        } as const
      )[c]!)
  );
}

export function distMeters(a: [number, number], b: [number, number]) {
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
export function fmtDurationHM(sec?: number, distanceM?: number) {
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

export function fmtMiles(distanceM?: number) {
  if (distanceM == null || !Number.isFinite(distanceM)) return "—";
  const mi = distanceM / M_PER_MI;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

const M_PER_DEG_LAT = 110_540;
function M_PER_DEG_LON_AT(latDeg: number) {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

export function bearingDeg(a: [number, number], b: [number, number]) {
  const midLat = (a[1] + b[1]) / 2;
  const kx = M_PER_DEG_LON_AT(midLat),
    ky = M_PER_DEG_LAT;
  const dx = (b[0] - a[0]) * kx;
  const dy = (b[1] - a[1]) * ky;
  const rad = Math.atan2(dx, dy);
  return (rad * 180) / Math.PI;
}
