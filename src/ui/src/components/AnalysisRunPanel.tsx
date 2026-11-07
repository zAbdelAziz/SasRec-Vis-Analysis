import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { AnalysisResult, JobStatus } from '../types/api';

type Props = { hypothesis: string; phase: 1 | 2; pair: 'a' | 'b';
  onResult: (value: AnalysisResult | null) => void; ready: boolean };

export default function AnalysisRunPanel({ hypothesis, phase, pair, onResult, ready }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const [maxUsers, setMaxUsers] = useState(hypothesis === 'h3' ? 300 : hypothesis === 'h1' ? 12 : 40);
  const [maxExamples, setMaxExamples] = useState(8);
  const [historyWindow, setHistoryWindow] = useState(20);
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(-1);
  const [topK, setTopK] = useState(20);
  // A and B start from different reproducible samples; they can override the seed.
  // Different sampling is NOT a substitute for the course's independent workflows.
  const [seed, setSeed] = useState(pair === 'a' ? 42 : 1042);

  const refresh = useCallback(async () => {
    try {
      const value = await api.analysisResults(hypothesis, phase, pair);
      setResult(value); onResult(value); setError('');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setResult(null); onResult(null); setError('');
      } else setError(cause instanceof Error ? cause.message : 'Failed to load results');
    }
  }, [hypothesis, phase, pair, onResult]);

  useEffect(() => { setResult(null); onResult(null); void refresh(); }, [refresh, onResult]);
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const timer = setInterval(() => {
      void api.job(job.job_id).then((next) => {
        setJob(next);
        if (next.status === 'complete') void refresh();
        if (next.status === 'failed') setError(next.error ?? 'Analysis failed');
      }).catch((cause) => setError(String(cause)));
    }, 1400);
    return () => clearInterval(timer);
  }, [job, refresh]);

  async function run() {
    setError('');
    try {
      setJob(await api.runAnalysis(hypothesis, phase, pair, {
        history_window: historyWindow, attention_layer: layer, attention_head: head,
        max_users: maxUsers, top_k: topK, max_examples: maxExamples, seed,
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to run analysis'); }
  }
  const busy = job?.status === 'queued' || job?.status === 'running';
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-slate-600">
        {busy ? `Computing · ${job?.progress ?? 0}%` : result ? `${result.n_records} observations · Pair ${pair.toUpperCase()}` : `No saved run for Pair ${pair.toUpperCase()}`}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-muted" onClick={() => void refresh()} disabled={busy}>Reload</button>
        <button type="button" className="btn-primary" disabled={!ready || busy} onClick={() => void run()}>{busy ? 'Running…' : 'Run analysis'}</button>
      </div>
    </div>
    <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
      <h3 className="mb-2 font-semibold text-slate-800">Run settings</h3>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label>Users / pairs<input className="field mt-1 w-24" type="number" min="1" max="300" value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} /></label>
        <label>Saved cases<input className="field mt-1 w-24" type="number" min="1" max="30" value={maxExamples} onChange={(e) => setMaxExamples(Number(e.target.value))} /></label>
        {['h2'].includes(hypothesis) && <label>Recommendations<input className="field mt-1 w-24" type="number" min="2" max="60" value={topK} onChange={(e) => setTopK(Number(e.target.value))} /></label>}
        {(hypothesis === 'h1' || hypothesis === 'h3') && <>
          <label>History window<select className="field mt-1" value={historyWindow} onChange={e => setHistoryWindow(Number(e.target.value))}>{[10,20,50,0].map(n => <option key={n} value={n}>{n || 'All'}</option>)}</select></label>
          {(phase === 1 || hypothesis === 'h3') && <label>Top-K<select className="field mt-1" value={topK} onChange={e => setTopK(Number(e.target.value))}>{[5,10,20,50].map(n => <option key={n}>{n}</option>)}</select></label>}
          {phase === 2 && <>
            <label>Layer (1-based)<input className="field mt-1 w-24" type="number" min="1" value={layer+1} onChange={e => setLayer(Number(e.target.value)-1)} /></label>
            <label>Head (0 = average)<input className="field mt-1 w-24" type="number" min="0" value={head+1} onChange={e => setHead(Number(e.target.value)-1)} /></label>
          </>}
        </>}
        <label>Random seed<input aria-label="Random seed" className="field mt-1 w-28" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></label>
      </div>
    </div>
    {!ready && <p className="mt-2 text-xs text-amber-700">Load a trained checkpoint and any required MovieLens metadata to enable analysis.</p>}
    {busy && <p className="mt-2 text-xs text-teal-700" role="status">{job?.detail ?? 'Analysis running'}</p>}
    {result && <p className="mt-2 text-xs text-slate-500">Seed {result.config.seed} · Run {result.run_id.slice(0, 8)} · {result.examples.length} saved examples</p>}
    {job?.status === 'failed' && <p className="mt-2 text-xs text-red-700">Analysis failed: {job.error}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
