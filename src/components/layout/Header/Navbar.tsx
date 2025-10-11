import clsx from "clsx";
import React, { useEffect, useMemo, useState, type FC } from "react";

export type HeatwaveHeaderProps = {
  className?: string;
  label?: string;

  elbowX?: number;

  arcRise?: number;

  offsetY?: number;

  seamPad?: number;

  tOuter?: number;
  tMid?: number;
  tInner?: number;
};

const DEFAULTS = {
  W_FIXED: 1200,
  PORTRAIT_RIGHT_INSET: 100,
} as const;

function radiusForArcRise(arcRise: number): number {
  return arcRise / (1 - 1 / Math.SQRT2);
}

function arcEndPoint(
  elbowX: number,
  y0: number,
  r: number
): { x: number; y: number } {
  const dxArc = r / Math.SQRT2;
  return { x: elbowX + dxArc, y: y0 - (r - dxArc) };
}

function interceptTopOrRight(
  x1: number,
  y1: number,
  vbW: number
): { x: number; y: number } {
  const x2 = x1 + y1;
  return x2 <= vbW ? { x: x2, y: 0 } : { x: vbW, y: Math.max(0, x2 - vbW) };
}

function buildStripePath(
  y0: number,
  elbowX: number,
  r: number,
  vbW: number
): string {
  const arcEnd = arcEndPoint(elbowX, y0, r);
  const toTop = interceptTopOrRight(arcEnd.x, arcEnd.y, vbW);
  return `M0 ${y0} H${elbowX} A ${r} ${r} 0 0 0 ${arcEnd.x} ${arcEnd.y} L ${toTop.x} ${toTop.y}`;
}

function buildLeftBackgroundPath(
  yBgTop: number,
  elbowX: number,
  r: number,
  vbW: number,
  height: number
): string {
  const arcEnd = arcEndPoint(elbowX, yBgTop, r);
  const toTop = interceptTopOrRight(arcEnd.x, arcEnd.y, vbW);

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
    vbWidth: DEFAULTS.W_FIXED,
    elbowVB: landscapeElbowX,
    isPortrait: false,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;

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
  const colOuter = "var(--color-orange,#af5418)";
  const colMid = "var(--color-red,#871e16)";
  const colInner = "var(--color-maroon,#4e080c)";

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

  const { vbWidth: vbW, elbowVB, isPortrait } = useHeaderViewport(elbowX);

  const r = useMemo(() => radiusForArcRise(arcRise), [arcRise]);

  const { pOuter, pMid, pInner, bgPath } = useMemo(() => {
    const pOuter = buildStripePath(yOuter, elbowVB, r, vbW);
    const pMid = buildStripePath(yMid, elbowVB, r, vbW);
    const pInner = buildStripePath(yInner, elbowVB, r, vbW);

    const yBgTop = yInner - tInner / 2 - seamPad;
    const bgPath = buildLeftBackgroundPath(yBgTop, elbowVB, r, vbW, H);

    return { pOuter, pMid, pInner, bgPath };
  }, [yOuter, yMid, yInner, tInner, seamPad, elbowVB, r, vbW, H]);

  const overlap = 1;

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: `${H}px`,
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
          {}
          <path d={bgPath} fill="#EEE3D5" />

          <defs>
            <path id="pOuter" d={pOuter} />
            <path id="pMid" d={pMid} />
            <path id="pInner" d={pInner} />

            {}
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

          {}
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
