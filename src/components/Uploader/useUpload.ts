import { useState } from "react";
import { runExtractor } from "@/lib/extractors";
import type { UploadData } from "@/types/uploads";
import type { ExtractResult } from "@/lib/extractors";

export type Phase = "idle" | "loading" | "done" | "error";

export function useUpload() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ExtractResult>();
  const [error, setError] = useState<string | null>(null);

  const upload = async (data: UploadData) => {
    try {
      setPhase("loading");
      const out = await runExtractor(data);
      setResult(out);
      setPhase("done");
    } catch (e: any) {
      setError(e?.message ?? "Extraction failed");
      setPhase("error");
    }
  };

  const reset = () => {
    setResult(undefined);
    setError(null);
    setPhase("idle");
  };

  return { phase, result, error, upload, reset };
}
