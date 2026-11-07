import { useCallback, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { hypothesisById } from '../content/hypotheses';
import { useAnalysisStore } from '../store/useAnalysisStore';
import type { AnalysisResult } from '../types/api';
import type { LayoutContext } from '../components/Layout';
import AnalysisRunPanel from '../components/AnalysisRunPanel';
import VisualizationWorkspace from '../components/VisualizationWorkspace';
import HowAnalysisWorks from '../components/HowAnalysisWorks';
import ErrorBoundary from '../components/ErrorBoundary';
import MetadataSetupNotice from '../components/MetadataSetupNotice';

const supported = ['h1', 'h2', 'h3'] as const;
type HypothesisId = typeof supported[number];

export default function HypothesisPage() {
  const { id } = useParams();
  const hypothesis = hypothesisById.get(id ?? '');
  const { status, refresh } = useOutletContext<LayoutContext>();
  const phase = useAnalysisStore((s) => s.phase);
  const pair = useAnalysisStore((s) => s.pair);
  const setPhase = useAnalysisStore((s) => s.setPhase);
  const setPair = useAnalysisStore((s) => s.setPair);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const onResult = useCallback((value: AnalysisResult | null) => setResult(value), []);
  if (!hypothesis || !supported.includes(id as HypothesisId)) {
    return <p className="text-slate-600">Hypothesis not found. Use the navigation above.</p>;
  }
  const requiresMetadata = ['h1', 'h2', 'h3'].includes(hypothesis.id);
  const ready = !!status?.model.ready && !!status.dataset.ready &&
    (!requiresMetadata || status.dataset.id_mapping === 'verified');
  const visibleResult = result?.hypothesis === hypothesis.id && result?.phase === phase && result?.pair === pair ? result : null;
  const scope = `${hypothesis.id}-${phase}-${pair}`;
  const role = phase === 1 ? (pair === 'a' ? 'AI-aided' : 'Human-only') : (pair === 'a' ? 'Human-only' : 'AI-aided');

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" aria-label="Analysis phase">
        {([1, 2] as const).map((value) => <button type="button" key={value} aria-pressed={phase === value}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${phase === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setPhase(value)}>Phase {value === 1 ? 'I' : 'II'}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" aria-label="Research pair">
          {(['a', 'b'] as const).map((value) => <button type="button" key={value} aria-pressed={pair === value}
            title={`${value === 'a' ? (phase === 1 ? 'AI-aided' : 'Human-only') : (phase === 1 ? 'Human-only' : 'AI-aided')} workflow`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${pair === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setPair(value)}>Pair {value.toUpperCase()}</button>)}
        </div>
        <span className="hidden text-xs text-slate-500 lg:inline">{role} workflow</span>
      </div>
    </div>

    {phase === 2 && <div className="text-sm text-slate-600">{hypothesis.phaseTwo}</div>}
    {requiresMetadata && status?.dataset.id_mapping !== 'verified' &&
      <MetadataSetupNotice dataset={status?.dataset} refresh={refresh} />}

    <ErrorBoundary resetKey={`${scope}-${visibleResult?.run_id ?? ''}`}>
      <VisualizationWorkspace key={scope} hypothesis={id as HypothesisId} phase={phase} pair={pair} result={visibleResult} />
    </ErrorBoundary>

    <footer className="grid items-start gap-4 border-t border-slate-200 pt-5 xl:grid-cols-2">
      <section className="surface min-w-0 p-4 lg:p-5" aria-label="Analysis controls">
        <h2 className="mb-3 text-base font-bold text-slate-900">Run or reload analysis</h2>
        <AnalysisRunPanel key={scope} hypothesis={hypothesis.id} phase={phase} pair={pair} onResult={onResult} ready={ready} />
      </section>
      <section className="surface min-w-0 p-4 lg:p-5" aria-label="How analysis works">
        <h2 className="mb-3 text-base font-bold text-slate-900">How analysis works</h2>
        <HowAnalysisWorks hypothesis={hypothesis} phase={phase} result={visibleResult} />
      </section>
    </footer>
  </div>;
}
