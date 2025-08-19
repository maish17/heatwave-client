import type { ExtractionResult } from "./types";

export function qualityGate(
  text: string,
  { minLength = 2_000 } = {}
): Omit<ExtractionResult, "tier" | "text"> {
  const reasons: string[] = [];
  let points = 0;
  const maxPts = 4;

  const len = text.length;
  if (len >= minLength) points++;
  else reasons.push("too short");

  const kws = [
    "privacy policy",
    "effective date",
    "last updated",

    "information we collect",
    "personal data",
    "personal information",
    "we collect",

    "use of data",
    "data sharing",
    "third parties",
    "tracking technologies",

    "your rights",
    "consent",
    "opt-out",

    "gdpr",
    "ccpa",
  ];
  const hits = kws.filter((k) => text.toLowerCase().includes(k)).length;
  if (hits >= 4) points++;
  else reasons.push("few privacy keywords");

  const paras = text.split(/\n{2,}/).filter(Boolean);
  const avg = paras.length ? len / paras.length : 0;
  if (paras.length >= 5 && avg >= 80) points++;
  else reasons.push("poor paragraph structure");

  /* bonus – always give 1 pt */
  points++;

  const score = points / maxPts;
  const passed = score >= 0.6 && len >= 1_000;

  return {
    passed,
    score,
    reasons,
    stats: {
      length: len,
      paragraphCount: paras.length,
      avgParagraphLen: avg,
      keywordHits: hits,
    },
  };
}
