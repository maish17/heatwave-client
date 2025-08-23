import clsx from "clsx";
import { useEffect, useState } from "react";
import type { FC } from "react";

type Props = {
  className?: string;
  label?: string;
  elbowX?: number; // hardcoded elbow for landscape
  arcRise?: number;
  offsetY?: number; // hardcoded always
  seamPad?: number;
  tOuter?: number;
  tMid?: number;
  tInner?: number;
};

const HeatwaveHeader: FC<Props> = ({
  className = "",
  label = "Heatwave",
  elbowX = 150, // landscape default
  arcRise = 7,
  offsetY = 50, // stays constant in both orientations
  seamPad = 1,
  tOuter = 7,
  tMid = 7,
  tInner = 7,
}) => {
  const colOuter = "var(--color-orange,#af5418)";
  const colMid = "var(--color-red,#871e16)";
  const colInner = "var(--color-maroon,#4e080c)";

  // ---- Intrinsic geometry (viewBox) ----
  const W_FIXED = 1200; // landscape viewBox width (px)
  const [vbW, setVbW] = useState(W_FIXED); // current viewBox width
  const [isPortrait, setIsPortrait] = useState(false);
  const [elbowVB, setElbowVB] = useState(elbowX); // elbow in viewBox units

  // Height is fixed in CSS px; compute from the hardcoded vertical metrics
  const yOuter = offsetY + tOuter / 2;
  const yMid = yOuter + (tOuter + tMid) / 2;
  const yInner = yMid + (tMid + tInner) / 2;
  const H = Math.ceil(yInner + tInner / 2); // fixed CSS height

  // Recalc ONLY what changes with orientation/width
  useEffect(() => {
    const recalc = () => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const portrait = wh > ww;
      setIsPortrait(portrait);

      if (portrait) {
        // Make viewBox width == CSS width so there's no non-uniform scaling.
        setVbW(ww);
        // Only elbow changes: "100px from the right edge"
        setElbowVB(Math.max(0, ww - 100));
      } else {
        // Landscape: everything is the hardcoded, static layout.
        setVbW(W_FIXED);
        setElbowVB(elbowX);
      }
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [elbowX]);

  // ---- Path geometry (uses current viewBox width & elbow) ----
  const r = arcRise / (1 - 1 / Math.SQRT2); // keeps the same 45°-arc construction
  const dxArc = r / Math.SQRT2;

  const arcEnd = (y0: number) => ({ x: elbowVB + dxArc, y: y0 - arcRise });

  const endAtTop = (x1: number, y1: number) => {
    // 45° line to the top edge; clamp to the current viewBox width
    const x2 = x1 + y1;
    return x2 <= vbW ? { x: x2, y: 0 } : { x: vbW, y: Math.max(0, x2 - vbW) };
  };

  const pathFor = (y0: number) => {
    const a = arcEnd(y0);
    const t = endAtTop(a.x, a.y);
    return `M0 ${y0} H${elbowVB} A ${r} ${r} 0 0 0 ${a.x} ${a.y} L ${t.x} ${t.y}`;
  };

  const FullRect = ({ fill, mask }: { fill: string; mask: string }) => (
    <rect
      x="0"
      y="0"
      width={vbW}
      height={H}
      fill={fill}
      mask={`url(#${mask})`}
    />
  );

  const overlap = 1; // tiny underlap to avoid slivers at joins

  return (
    <header
      className={clsx("fixed inset-x-0 top-0 z-50 bg-transparent", className)}
      style={{ height: `${H}px` }}
    >
      <div className="relative">
        <svg
          className="absolute left-0 top-0 z-0 pointer-events-none"
          // Fixed height always; width is static in landscape, 100% in portrait.
          style={{
            height: `${H}px`,
            width: isPortrait ? "100%" : `${W_FIXED}px`,
          }}
          viewBox={`0 0 ${vbW} ${H}`} // dynamic viewBox width
          preserveAspectRatio="xMinYMin meet" // no non-uniform stretch → no warping
          aria-hidden="true"
        >
          <rect x="0" y="0" width={vbW} height={H} fill="var(--color-bg)" />
          <defs>
            <path id="pOuter" d={pathFor(yOuter)} />
            <path id="pMid" d={pathFor(yMid)} />
            <path id="pInner" d={pathFor(yInner)} />

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

          <FullRect fill={colInner} mask="mInner" />
          <FullRect fill={colMid} mask="mMid" />
          <FullRect fill={colOuter} mask="mOuter" />
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
