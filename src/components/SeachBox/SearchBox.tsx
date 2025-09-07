// src/components/SeachBox/SearchBox.tsx
import { useEffect, useRef, useState } from "react";
import { forwardGeocode, type ForwardHit } from "../../lib/geocode";

type Props = {
  biasCenter?: [number, number] | (() => [number, number]);
  onPick(hit: ForwardHit): void;
  className?: string;
};

export default function SeachBox({
  biasCenter,
  onPick,
  className = "",
}: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ForwardHit[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Remember the last-selected label so we don't immediately refetch suggestions for it
  const selectedLabelRef = useRef<string | null>(null);

  const debounced = useDebounced(q, 300);
  const MIN_LEN = 3;

  useEffect(() => {
    const query = debounced.trim();

    // If the input exactly matches the selected label, suppress lookups and keep the menu closed
    if (selectedLabelRef.current && query === selectedLabelRef.current) {
      setOpen(false);
      setResults([]);
      setLoading(false);
      return;
    }

    if (query.length < MIN_LEN) {
      setResults([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;

    (async () => {
      try {
        setLoading(true);

        const proximity =
          typeof biasCenter === "function" ? biasCenter() : biasCenter;

        const opts: {
          proximity?: [number, number];
          limit?: number;
          lang?: string;
          countrycodes?: string;
        } = { limit: 10, lang: "en", countrycodes: "us" };
        if (proximity) opts.proximity = proximity;

        const hits = await forwardGeocode(query, opts);
        if (ctl.signal.aborted) return;

        if (import.meta.env.DEV) {
          const bySrc = hits.reduce<Record<string, number>>((acc, h) => {
            const s = h.src ?? "unknown";
            acc[s] = (acc[s] ?? 0) + 1;
            return acc;
          }, {});
          console.debug(`[SearchBox] "${query}" results:`, bySrc, hits[0]);
        }

        setResults(hits);
        setOpen(true);
        setHighlight(0);
      } catch (e) {
        console.error("[geocode]", e);
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctl.abort();
  }, [debounced, biasCenter]);

  const pick = (i: number) => {
    const hit = results[i];
    if (!hit) return;

    // Fill the input with the chosen label and suppress immediate re-search
    selectedLabelRef.current = hit.label;
    setQ(hit.label);
    setResults([]);
    setOpen(false);
    setHighlight(0);

    onPick(hit);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If user edits after a selection, clear the selection sentinel so lookups resume
    if (selectedLabelRef.current) selectedLabelRef.current = null;
    setQ(e.target.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(highlight);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        value={q}
        onChange={onChange}
        onFocus={() => q && results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search address or place…"
        className="w-[min(90vw,520px)] rounded-xl bg-white/90 px-4 py-2 text-[15px] shadow
                   outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-black/20"
      />
      {loading && (
        <div className="absolute right-2 top-2 text-xs text-gray-500">…</div>
      )}

      {open && results.length > 0 && (
        <div
          className="absolute z-20 mt-2 max-h-[50vh] w-[min(90vw,520px)] overflow-auto
                        rounded-xl border border-black/10 bg-white/95 shadow-lg backdrop-blur"
        >
          {results.map((r, i) => (
            <button
              key={r.id + i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              className={`block w-full text-left px-3 py-2 text-[14px] hover:bg-black/5 ${
                i === highlight ? "bg-black/5" : ""
              }`}
              title={r.src ? `from ${r.src}` : undefined}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** tiny debounce hook (local) */
function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
