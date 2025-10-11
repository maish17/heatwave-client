// src/components/BottomBar.tsx
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

function useLandscape() {
  const [land, setLand] = useState(false);
  useEffect(() => {
    const update = () => setLand(window.innerWidth > window.innerHeight);
    update();
    const mql = window.matchMedia?.("(orientation: landscape)");
    mql?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      mql?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return land;
}

type Props = { className?: string; children?: ReactNode };

export default function BottomBar({ className = "", children }: Props) {
  const landscape = useLandscape();
  const rightSafe = "env(safe-area-inset-right, 0px)";

  return (
    <aside
      className={clsx(
        "fixed z-50 pointer-events-auto",
        landscape
          ? "right-0 top-1/2 -translate-y-1/2 w-[min(40vw,520px)] h-[60vh]"
          : "inset-x-0 bottom-0 w-full",
        className
      )}
      aria-label="Bottom controls"
      style={landscape ? { right: rightSafe } : undefined}
    >
      <div
        className={clsx(
          "overflow-hidden shadow-[0_10px_30px_rgba(92,15,20,0.18)] ring-1 ring-[#5c0f14]/10 rounded-l-2xl",
          landscape
            ? "h-full backdrop-blur-sm"
            : "mx-auto w-[min(94vw,980px)] rounded-t-2xl backdrop-blur-sm"
        )}
      >
        {}
        <div aria-hidden className="leading-none">
          <div className="h-[7px] bg-[#e19638]" /> {/* light */}
          <div className="h-[7px] bg-[#b44427]" /> {/* mid   */}
          <div className="h-[7px] bg-[#5c0f14]" /> {/* dark  */}
        </div>

        {}
        <div
          className={clsx(
            "bg-[#f3ece4]/95",
            landscape
              ? "h-full px-3 pt-3 pb-3 overflow-y-auto"
              : "px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] min-h-[25vh]"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">{children}</div>
          </div>
          <div className="flex-1" />
        </div>
      </div>
    </aside>
  );
}
