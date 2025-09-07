import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  className?: string;
  children?: ReactNode; // put <SearchBox /> here
};

export default function BottomBar({ className = "", children }: Props) {
  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-20 pointer-events-none",
        className
      )}
      aria-label="Bottom controls"
    >
      <div className="mx-auto w-[min(94vw,980px)] pointer-events-auto">
        {/* the sheet */}
        <div
          className={clsx(
            "rounded-t-2xl border border-black/10 bg-white/80 backdrop-blur shadow-lg",
            "px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]",
            "min-h-[25vh] flex flex-col gap-3"
          )}
        >
          {/* header row: search only */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">{children}</div>
          </div>

          {/* spacer area — gives you visible space below the search box */}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
