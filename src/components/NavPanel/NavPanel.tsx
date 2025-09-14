// src/components/NavPanel/NavPanel.tsx
import { useMemo } from "react";
import type { RouteResult, GHInstruction } from "../../lib/routing";
import { fmtDistImperial, fmtEta, signToText } from "../../lib/nav";

type Props = {
  route: RouteResult;
  stepIndex: number;
  startedAt: number; // ms since epoch
  onEnd(): void;

  // live values pushed by MapView.onNavTick (optional fallbacks inside)
  stepRemainingM?: number;
  totalRemainingM?: number;
};

export default function NavPanel({
  route,
  stepIndex,
  startedAt,
  onEnd,
  stepRemainingM,
  totalRemainingM,
}: Props) {
  // Normalize instructions to a concrete array
  const steps: GHInstruction[] = (route.instructions ?? []) as GHInstruction[];

  // Ensure first step has readable text (GH sometimes leaves it empty)
  if (steps.length > 0) {
    const s0 = steps[0] as GHInstruction;
    if (!s0.text || s0.text.trim() === "") {
      const label = s0.street_name
        ? `${signToText(s0.sign)} onto ${s0.street_name}`
        : signToText(s0.sign);
      steps[0] = {
        distance: s0.distance ?? 0,
        time: s0.time ?? 0,
        text: label,
        sign: s0.sign ?? 0,
        interval: (s0.interval as [number, number]) ?? [0, 1],
        street_name: s0.street_name ?? "",
        last_heading: s0.last_heading ?? 0,
      };
    }
  }

  // Clamp index safely
  const safeIndex = Math.min(
    Math.max(0, stepIndex),
    Math.max(0, steps.length - 1)
  );
  const current = steps[safeIndex];
  const next1 = steps[safeIndex + 1];
  const next2 = steps[safeIndex + 2];

  // Remaining distance and ETA
  const fallbackRemainingM = useMemo(() => {
    let m = 0;
    for (let i = safeIndex; i < steps.length; i++) m += steps[i]?.distance ?? 0;
    return m || route.distance || 0;
  }, [steps, safeIndex, route.distance]);

  const remainingMeters = totalRemainingM ?? fallbackRemainingM;

  // Use route's average speed if available
  const avgSpeedMps = (route.distance ?? 0) / Math.max(1, route.duration ?? 1);
  const etaSec = Math.max(
    0,
    Math.round(remainingMeters / Math.max(0.5, avgSpeedMps))
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold">
          {fmtDistImperial(remainingMeters)} · {fmtEta(etaSec)}
        </div>
        <button
          onClick={onEnd}
          className="rounded-lg bg-black text-white text-sm px-3 py-1.5 hover:bg-black/90"
        >
          End route
        </button>
      </div>

      {/* Current step */}
      <div className="rounded-xl border border-black/10 bg-white/95 shadow px-3 py-3">
        <div className="text-base font-medium">
          {current?.text || signToText(current?.sign ?? 0)}
        </div>
        <div className="text-sm text-gray-600">
          {fmtDistImperial(stepRemainingM ?? current?.distance ?? 0)}
        </div>
      </div>

      {/* Up next */}
      {!!next1 && (
        <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-2">
          <div className="text-[14px]">
            Next: {next1.text || signToText(next1.sign)}
          </div>
          <div className="text-xs text-gray-600">
            {fmtDistImperial(next1.distance ?? 0)}
          </div>
        </div>
      )}
      {!!next2 && (
        <div className="rounded-xl border border-black/10 bg-white/70 px-3 py-2">
          <div className="text-[13px]">
            Then: {next2.text || signToText(next2.sign)}
          </div>
        </div>
      )}
    </div>
  );
}
