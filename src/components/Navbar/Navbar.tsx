// src/components/HeatwaveHeader.tsx
import clsx from "clsx";
import React, { useEffect, useMemo, useState, type FC } from "react";

/**
 * Props control the decorative SVG header with three diagonal stripes.
 * All defaults preserve current visual behavior.
 */
export type HeatwaveHeaderProps = {
  className?: string;
  label?: string;

  /** Landscape-only elbow X position (in viewBox units). */
  elbowX?: number;

  /** Vertical rise of the 45° arc's end point (px in viewBox units). */
  arcRise?: number;

  /** Baseline Y offset from top where the first (outer) stripe centerline starts. */
  offsetY?: number;

  /**
   * Tiny inset under the inner stripe's top to prevent the background peeking
   * through seam antialiasing.
   */
  seamPad?: number;

  /** Stripe stroke thicknesses (viewBox units). */
  tOuter?: number;
  tMid?: number;
  tInner?: number;
};

const DEFAULTS = {
  W_FIXED: 1200, // landscape viewBox width
  PORTRAIT_RIGHT_INSET: 100, // elbow sits ~100px from right in portrait
} as const;

/** Small, local helpers (pure functions) */

// 45° arc helper: radius for a quarter-turn constructed via rise along a 45° path.
// Derived from r = arcRise / (1 - 1/√2)
function radiusForArcRise(arcRise: number): number {
  return arcRise / (1 - 1 / Math.SQRT2);
}

/** End point of the circular 45° arc from the horizontal segment. */
function arcEndPoint(
  elbowX: number,
  y0: number,
  r: number
): { x: number; y: number } {
  const dxArc = r / Math.SQRT2;
  return { x: elbowX + dxArc, y: y0 - (r - dxArc) }; // equivalent to y0 - arcRise
}

/**
 * Continue at 45° to the top edge; clamp at right edge if needed.
 * Given a start (x1,y1) and current viewBox width, return the intercept on top or right.
 */
function interceptTopOrRight(
  x1: number,
  y1: number,
  vbW: number
): { x: number; y: number } {
  const x2 = x1 + y1; // 45° slope up-left towards y=0
  return x2 <= vbW ? { x: x2, y: 0 } : { x: vbW, y: Math.max(0, x2 - vbW) };
}

/** Build the centerline path string for a stripe at centerline y0. */
function buildStripePath(
  y0: number,
  elbowX: number,
  r: number,
  vbW: number
): string {
  const arcEnd = arcEndPoint(elbowX, y0, r);
  const toTop = interceptTopOrRight(arcEnd.x, arcEnd.y, vbW);
  // M.. H(elbow) A(45°) to arcEnd, then L to top or right edge intercept.
  return `M0 ${y0} H${elbowX} A ${r} ${r} 0 0 0 ${arcEnd.x} ${arcEnd.y} L ${toTop.x} ${toTop.y}`;
}

/** Build the left-side background polygon bounded by the stripes' top edge. */
function buildLeftBackgroundPath(
  yBgTop: number,
  elbowX: number,
  r: number,
  vbW: number,
  height: number
): string {
  const arcEnd = arcEndPoint(elbowX, yBgTop, r);
  const toTop = interceptTopOrRight(arcEnd.x, arcEnd.y, vbW);
  // Outline the left region: bottom-left → top-left → intercept → down 45° →
  // reverse arc back to elbow → left to x=0 at yBgTop → close.
  return [
    `M 0 ${height}`,
    `L 0 0`,
    `L ${toTop.x} ${toTop.y}`,
    `L ${arcEnd.x} ${arcEnd.y}`,
    `A ${r} ${r} 0 0 1 ${elbowX} ${yBgTop}`,
    `H 0`,
    `Z`,
  ].join(" ");
}

/** Hook: read viewport width/height, portrait flag, and elbow in VB units. */
function useHeaderViewport(landscapeElbowX: number): {
  vbWidth: number;
  elbowVB: number;
  isPortrait: boolean;
} {
  type ViewportState = {
    vbWidth: number;
    elbowVB: number;
    isPortrait: boolean;
  };

  const [state, setState] = useState<ViewportState>(() => ({
    vbWidth: DEFAULTS.W_FIXED, // number
    elbowVB: landscapeElbowX, // number
    isPortrait: false, // boolean
  }));

  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    let raf = 0;

    const measure = () => {
      const ww = window.innerWidth || DEFAULTS.W_FIXED;
      const wh = window.innerHeight || ww;
      const portrait = wh > ww;

      const vbWidth = portrait ? ww : DEFAULTS.W_FIXED;
      const elbowVB = portrait
        ? Math.max(0, ww - DEFAULTS.PORTRAIT_RIGHT_INSET)
        : landscapeElbowX;

      setState((prev) => {
        if (
          prev.vbWidth === vbWidth &&
          prev.elbowVB === elbowVB &&
          prev.isPortrait === portrait
        ) {
          return prev;
        }
        const next: ViewportState = { vbWidth, elbowVB, isPortrait: portrait };
        return next;
      });
    };

    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [landscapeElbowX]);

  return state;
}

const HeatwaveHeader: FC<HeatwaveHeaderProps> = ({
  className = "",
  label = "Heatwave",
  elbowX = 150,
  arcRise = 7,
  offsetY = 50,
  seamPad = 1,
  tOuter = 7,
  tMid = 7,
  tInner = 7,
}) => {
  // Colors remain CSS-variable driven (no change to behavior)
  const colOuter = "var(--color-orange,#af5418)";
  const colMid = "var(--color-red,#871e16)";
  const colInner = "var(--color-maroon,#4e080c)";

  // 1) Geometry that does NOT depend on viewport width
  const {
    yOuter,
    yMid,
    yInner,
    height: H,
  } = useMemo(() => {
    const yOuter = offsetY + tOuter / 2;
    const yMid = yOuter + (tOuter + tMid) / 2;
    const yInner = yMid + (tMid + tInner) / 2;
    const height = Math.ceil(yInner + tInner / 2);
    return { yOuter, yMid, yInner, height };
  }, [offsetY, tOuter, tMid, tInner]);

  // 2) Read and react to viewport width/orientation for viewBox + elbow position
  const { vbWidth: vbW, elbowVB, isPortrait } = useHeaderViewport(elbowX);

  // 3) Arc radius from arcRise; used across all paths
  const r = useMemo(() => radiusForArcRise(arcRise), [arcRise]);

  // 4) Build path strings (stable across renders unless inputs truly change)
  const { pOuter, pMid, pInner, bgPath } = useMemo(() => {
    // Centerline paths
    const pOuter = buildStripePath(yOuter, elbowVB, r, vbW);
    const pMid = buildStripePath(yMid, elbowVB, r, vbW);
    const pInner = buildStripePath(yInner, elbowVB, r, vbW);

    // Background bounded by top of inner stripe minus seamPad
    const yBgTop = yInner - tInner / 2 - seamPad;
    const bgPath = buildLeftBackgroundPath(yBgTop, elbowVB, r, vbW, H);

    return { pOuter, pMid, pInner, bgPath };
  }, [yOuter, yMid, yInner, tInner, seamPad, elbowVB, r, vbW, H]);

  // Tiny underlap to avoid hairline slivers at joins when masks overlap
  const overlap = 1;

  // Expose header height via CSS var for downstream layout
  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: `${H}px`,
      // Expose to CSS as --hw-header-h
      ["--hw-header-h" as any]: `${H}px`,
    }),
    [H]
  );

  return (
    <header
      className={clsx("fixed inset-x-0 top-0 z-50 bg-transparent", className)}
      style={headerStyle}
      aria-label="Heatwave header"
    >
      <div className="relative">
        <svg
          className="absolute left-0 top-0 z-0 pointer-events-none"
          style={{
            height: `${H}px`,
            width: isPortrait ? "100%" : `${DEFAULTS.W_FIXED}px`,
          }}
          viewBox={`0 0 ${vbW} ${H}`}
          preserveAspectRatio="xMinYMin meet"
          aria-hidden="true"
          focusable="false"
        >
          {/* Background strictly on the LEFT of the stripes */}
          <path d={bgPath} fill="var(--color-bg)" />

          <defs>
            <path id="pOuter" d={pOuter} />
            <path id="pMid" d={pMid} />
            <path id="pInner" d={pInner} />

            {/* Masks convert centerlines into fat, rounded stripes with controlled overlap */}
            <mask
              id="mOuter"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width={vbW} height={H} fill="black" />
              <use
                href="#pOuter"
                stroke="white"
                strokeWidth={tOuter}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>

            <mask
              id="mMid"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width={vbW} height={H} fill="black" />
              <use
                href="#pMid"
                stroke="white"
                strokeWidth={tMid}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <use
                href="#pOuter"
                stroke="black"
                strokeWidth={Math.max(0, tOuter - overlap * 2)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>

            <mask
              id="mInner"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width={vbW} height={H} fill="black" />
              <use
                href="#pInner"
                stroke="white"
                strokeWidth={tInner}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <use
                href="#pMid"
                stroke="black"
                strokeWidth={Math.max(0, tMid - overlap * 2)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
          </defs>

          {/* Render stripes from inner → mid → outer so halos look correct */}
          <rect
            x="0"
            y="0"
            width={vbW}
            height={H}
            fill={colInner}
            mask="url(#mInner)"
          />
          <rect
            x="0"
            y="0"
            width={vbW}
            height={H}
            fill={colMid}
            mask="url(#mMid)"
          />
          <rect
            x="0"
            y="0"
            width={vbW}
            height={H}
            fill={colOuter}
            mask="url(#mOuter)"
          />
        </svg>

        {/* Title pinned; no breakpoint shifts */}
        <div className="absolute z-10 left-2 top-3">
          <h1
            className="font-garamond text-[clamp(3px,40px,130px)] leading-none text-text"
            style={{ letterSpacing: "0.02em" }}
          >
            <a
              href="/"
              className="focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              {label}
            </a>
          </h1>
        </div>
      </div>
    </header>
  );
};

export default HeatwaveHeader;
