export function overlayOffsetsBottomLeft() {
  if (typeof window === "undefined") {
    return { left: "12px", bottom: "12px" };
  }
  const portrait = window.innerHeight > window.innerWidth;
  const bar = document.querySelector(
    'aside[aria-label="Bottom controls"]'
  ) as HTMLElement | null;
  const barH =
    bar?.getBoundingClientRect().height ??
    Math.round(window.innerHeight * 0.25);

  return {
    left: "calc(env(safe-area-inset-left, 0px) + 12px)",
    bottom: portrait
      ? `calc(${barH}px + env(safe-area-inset-bottom, 0px) + 12px)`
      : `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
  };
}

export function positionAttribution(mapEl?: HTMLElement | null) {
  const root =
    mapEl ?? (document.querySelector(".maplibregl-map") as HTMLElement | null);
  if (!root) return;

  const corner = root.querySelector(
    ".maplibregl-ctrl-bottom-right"
  ) as HTMLElement | null;
  if (!corner) return;

  const portrait = window.innerHeight > window.innerWidth;
  const bar = document.querySelector(
    'aside[aria-label="Bottom controls"]'
  ) as HTMLElement | null;
  const barH =
    bar?.getBoundingClientRect().height ??
    Math.round(window.innerHeight * 0.25);

  if (portrait) {
    corner.style.right = "calc(env(safe-area-inset-right, 0px) + 8px)";
    corner.style.bottom = `calc(${barH}px + env(safe-area-inset-bottom, 0px) + 25px)`;
    corner.style.zIndex = "60";
  } else {
    corner.style.right = "calc(env(safe-area-inset-right, 0px) + 8px)";
    corner.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 8px)";
    corner.style.zIndex = "";
  }
}
