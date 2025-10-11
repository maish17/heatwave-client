export type View = { center: [number, number]; zoom: number };

declare global {
  interface Window {
    __HW_VIEW__?: View;
  }
}

export function parseHashView(): View | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(
    /^#?(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/
  );
  if (!m) return null;
  const z = Number(m[1]),
    lat = Number(m[2]),
    lng = Number(m[3]);
  if (Number.isFinite(z) && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { center: [lng, lat], zoom: z };
  }
  return null;
}

export function loadInitialView(): View {
  const fromHash = parseHashView();
  if (fromHash) return fromHash;
  if (typeof window !== "undefined" && window.__HW_VIEW__)
    return window.__HW_VIEW__!;
  try {
    const s = sessionStorage.getItem("hw:view");
    if (s) return JSON.parse(s) as View;
  } catch {}
  return { center: [-99.965735, 31.09691], zoom: 5 };
}

export function saveView(v: View) {
  if (typeof window !== "undefined") window.__HW_VIEW__ = v;
  try {
    sessionStorage.setItem("hw:view", JSON.stringify(v));
  } catch {}
}
