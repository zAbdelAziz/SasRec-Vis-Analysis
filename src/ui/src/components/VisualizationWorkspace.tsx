import type { AnalysisResult, RawRow } from '../types/api';
import { findExample, str } from '../lib/records';
import { useAnalysisStore } from '../store/useAnalysisStore';
import H1View from '../visualizations/H1View';
import H3View from '../visualizations/H3View';
import H2View from '../visualizations/H2View';

const views = { h1: H1View, h2: H2View, h3: H3View };
type Props = { hypothesis: keyof typeof views; phase: 1 | 2; pair: 'a' | 'b'; result: AnalysisResult | null };

export default function VisualizationWorkspace({ hypothesis, phase, pair, result }: Props) {
  const scope = `${hypothesis}-${phase}-${pair}`;
  const select = useAnalysisStore((s) => s.selectExample);
  const examples = result?.examples ?? [];
  const Component = views[hypothesis];
  function onPick(row: RawRow, keys: string[]) {
    const example = findExample(examples, row, keys);
    if (example) select(scope, str(example, 'example_id'));
    else select(scope, null);
  }
  if (!result) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
    <p className="font-semibold text-slate-700">No saved analysis for this pair and phase.</p>
    <p className="mt-2 text-sm text-slate-500">Run this pair's analysis to generate its own results. No test data is displayed.</p>
  </div>;
  return <section className="space-y-3">
    {result.status !== 'complete' && <p className="text-xs text-amber-700">The saved analysis is incomplete.</p>}
    <Component result={result} scope={scope} onPick={onPick} />

  </section>;
}
