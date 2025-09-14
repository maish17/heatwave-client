// src/lib/nav.ts
import type { Feature, LineString } from "geojson";

export type Pt = [number, number]; // [lng, lat]

/** Haversine distance in meters */
export function meters(a: Pt, b: Pt): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function fmtDistImperial(m: number): string {
  const ft = m * 3.28084;
  if (ft < 950) return `${Math.round(ft / 25) * 25} ft`;
  const mi = m / 1609.344;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function fmtEta(sec: number): string {
  const min = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(min / 60),
    m = min % 60;
  return h ? `${h} hr ${m} min` : `${min} min`;
}

export function signToText(sign: number): string {
  // Common GraphHopper signs
  switch (sign) {
    case 6:
    case -6:
      return "Make a U-turn";
    case -3:
      return "Sharp left";
    case -2:
      return "Turn left";
    case -1:
      return "Slight left";
    case 0:
      return "Continue";
    case 1:
      return "Slight right";
    case 2:
      return "Turn right";
    case 3:
      return "Sharp right";
    case 4:
      return "Arrive";
    case 13:
      return "Keep left";
    case 14:
      return "Keep right";
    default:
      return "Continue";
  }
}

/**
 * Snap a point to a polyline.
 * Returns:
 *  - closest: snapped lon/lat
 *  - offDistM: meters off the line
 *  - nextIndex: index of the next vertex after the snapped point
 *  - traveledM: meters along the line up to the snapped point
 */
export function snapToLine(
  line: Feature<LineString>,
  p: Pt
): { closest: Pt; offDistM: number; nextIndex: number; traveledM: number } {
  const coords = (line.geometry?.coordinates as Pt[]) ?? [];
  if (coords.length < 2) {
    return {
      closest: coords[0] ?? p,
      offDistM: coords[0] ? meters(p, coords[0]) : 0,
      nextIndex: 0,
      traveledM: 0,
    };
  }

  // Planar projection factors using segment-midpoint latitude
  const M_PER_DEG_LAT = 110_540;
  const M_PER_DEG_LON_AT = (latDeg: number) =>
    111_320 * Math.cos((latDeg * Math.PI) / 180);

  let best: { d: number; pt: Pt; idx: number; along: number } | null = null;
  let cum = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const A = coords[i]!;
    const B = coords[i + 1]!;
    const segLen = meters(A, B);

    const lat = (A[1] + B[1]) / 2;
    const kx = M_PER_DEG_LON_AT(lat);
    const ky = M_PER_DEG_LAT;

    const ax = A[0] * kx,
      ay = A[1] * ky;
    const bx = B[0] * kx,
      by = B[1] * ky;
    const px = p[0] * kx,
      py = p[1] * ky;

    const abx = bx - ax,
      aby = by - ay;
    const denom = abx * abx + aby * aby || 1; // avoid 0
    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * abx + (py - ay) * aby) / denom)
    );
    const projx = ax + t * abx,
      projy = ay + t * aby;

    const d = Math.hypot(px - projx, py - projy);
    if (!best || d < best.d) {
      best = {
        d,
        pt: [projx / kx, projy / ky],
        idx: i + 1, // next vertex after projection
        along: cum + segLen * t,
      };
    }
    cum += segLen;
  }

  return {
    closest: best!.pt,
    offDistM: best!.d,
    nextIndex: best!.idx,
    traveledM: best!.along,
  };
}

/** Safe length between vertex indices [i0, i1] (meters) */
export function lengthBetween(coords: Pt[], i0: number, i1: number) {
  if (coords.length < 2) return 0;
  let start = Math.max(0, Math.min(i0, coords.length - 1));
  let end = Math.max(start, Math.min(i1, coords.length - 1));
  let m = 0;
  for (let i = start; i < end; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    m += meters(a, b);
  }
  return m;
}
