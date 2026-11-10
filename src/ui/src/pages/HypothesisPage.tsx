import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { availablePairs, availablePhases, hypothesisById } from '../content/hypotheses';
import { useAnalysisStore } from '../store/useAnalysisStore';
import type { AnalysisResult } from '../types/api';
import type { LayoutContext } from '../components/Layout';
import AnalysisRunPanel from '../components/AnalysisRunPanel';
import VisualizationWorkspace from '../components/VisualizationWorkspace';
import HowAnalysisWorks from '../components/HowAnalysisWorks';
import ErrorBoundary from '../components/ErrorBoundary';
import MetadataSetupNotice from '../components/MetadataSetupNotice';
import NotebookSavedPanel from '../components/NotebookSavedPanel';
import ResearchMaterials from '../components/ResearchMaterials';
import ResearchQuestionHeader from '../components/ResearchQuestionHeader';
import { pairBFraming } from '../content/pairBFraming';

export default function HypothesisPage() {
  const { id } = useParams();
  const hypothesis = hypothesisById.get(id ?? '');
  const { status, refresh } = useOutletContext<LayoutContext>();
  const storedPhase = useAnalysisStore(s => s.phase);
  const storedPair = useAnalysisStore(s => s.pair);
  const setPhase = useAnalysisStore(s => s.setPhase);
  const setPair = useAnalysisStore(s => s.setPair);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const onResult = useCallback((value: AnalysisResult | null) => setResult(value), []);
  const phases = hypothesis ? availablePhases(hypothesis) : [];
  const phase = phases.includes(storedPhase) ? storedPhase : (phases[0] ?? 1);
  const pairs = hypothesis ? availablePairs(hypothesis, phase) : [];
  const pair = pairs.includes(storedPair) ? storedPair : (pairs[0] ?? 'a');

  useEffect(() => {
    if (storedPhase !== phase) setPhase(phase);
    if (storedPair !== pair) setPair(pair);
  }, [storedPhase, storedPair, phase, pair, setPhase, setPair]);

  if (!hypothesis) return <p className="text-slate-600">Hypothesis not found. Use the navigation above.</p>;

  const notebook = phase === 1 && pair === 'b';
  const researchIntro = notebook ? pairBFraming[hypothesis.id] : undefined;
  const requiresMetadata = !notebook;
  const ready = !!status?.model.ready && !!status.dataset.ready &&
    (!requiresMetadata || status.dataset.id_mapping === 'verified');
  const visibleResult = result?.hypothesis === hypothesis.id && result?.phase === phase && result?.pair === pair ? result : null;
  const scope = `${hypothesis.id}-${phase}-${pair}`;

  return <div className="space-y-4">
    {(phases.length > 1 || pairs.length > 1) && <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-3">
      {phases.length > 1 && <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" aria-label="Analysis phase">
        {phases.map(value => <button type="button" key={value} aria-pressed={phase === value}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${phase === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}
          onClick={() => { setPhase(value); const valid = availablePairs(hypothesis, value); if (!valid.includes(pair)) setPair(valid[0]); }}>
          Phase {value === 1 ? 'I' : 'II'}
        </button>)}
      </div>}
      {pairs.length > 1 && <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" aria-label="Research pair">
        {pairs.map(value => <button type="button" key={value} aria-pressed={pair === value}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${pair === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setPair(value)}>Pair {value.toUpperCase()}</button>)}
      </div>}
    </div>}

    {researchIntro && <ResearchQuestionHeader {...researchIntro} />}
    {!notebook && phase === 2 && <div className="text-sm text-slate-600">{hypothesis.phaseTwo}</div>}
    {!notebook && status?.dataset.id_mapping !== 'verified' &&
      <MetadataSetupNotice dataset={status?.dataset} refresh={refresh} />}

    <ErrorBoundary resetKey={`${scope}-${visibleResult?.run_id ?? ''}`}>
      <VisualizationWorkspace key={scope} hypothesis={hypothesis.id} phase={phase} pair={pair} result={visibleResult} />
    </ErrorBoundary>

    <footer className="grid items-start gap-4 border-t border-slate-200 pt-5 xl:grid-cols-2">
      <section className="surface min-w-0 p-4 lg:p-5" aria-label="Analysis controls">
        <h2 className="mb-3 text-base font-bold text-slate-900">Run or reload analysis</h2>
        {notebook ? <NotebookSavedPanel key={scope} hypothesis={hypothesis.id} onResult={onResult} /> :
          <AnalysisRunPanel key={scope} hypothesis={hypothesis.id} phase={phase} pair={pair} onResult={onResult} ready={ready} />}
      </section>
      {notebook ? <ResearchMaterials key="pair-b-research-materials" /> :
        <section className="surface min-w-0 p-4 lg:p-5" aria-label="How analysis works">
          <h2 className="mb-3 text-base font-bold text-slate-900">How analysis works</h2>
          <HowAnalysisWorks hypothesis={hypothesis} phase={phase} result={visibleResult} />
        </section>}
    </footer>
  </div>;
}
