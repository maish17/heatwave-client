import type { ExtractResult } from "@/lib/extractors";

interface Props {
  res: ExtractResult;
}
const ResultPanel = ({ res }: Props) => (
  <section className="max-w-prose mx-auto py-8 px-4">
    <h2 className="font-hyper font-bold mb-4">
      Extracted from {res.source.toUpperCase()}
    </h2>
    <pre className="whitespace-pre-wrap text-sm">{res.text}</pre>
    {/* TODO: add company, version, translation buttons */}
  </section>
);

export default ResultPanel;
