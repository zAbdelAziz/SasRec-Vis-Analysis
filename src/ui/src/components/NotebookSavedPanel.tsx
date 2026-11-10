import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { AnalysisResult, JobStatus, NotebookRunReadiness } from '../types/api';

export default function NotebookSavedPanel({ hypothesis, onResult }: {
  hypothesis: string; onResult: (value: AnalysisResult | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<AnalysisResult | null>(null);
  const [readiness, setReadiness] = useState<NotebookRunReadiness | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try { const response = await api.analysisResults(hypothesis, 1, 'b'); setLoaded(response); onResult(response); setError(''); }
    catch (cause) { onResult(null); setLoaded(null); setError(cause instanceof ApiError && cause.status === 404 ? 'Saved research data is unavailable.' : String(cause)); }
    finally { setBusy(false); }
  }, [hypothesis, onResult]);
  useEffect(() => { void refresh(); void api.notebookRunReadiness().then(setReadiness).catch(() => {}); }, [refresh]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const timer = window.setInterval(() => {
      void api.job(job.job_id).then(async next => {
        setJob(next);
        if (next.status === 'complete' && next.run_id) {
          try { const result = await api.notebookGeneratedResults(next.run_id, hypothesis); setLoaded(result); onResult(result); setError(''); }
          catch (cause) { setError(String(cause)); }
        }
      }).catch((cause: Error) => { setError(cause.message); });
    }, 1600);
    return () => window.clearInterval(timer);
  }, [job, hypothesis, onResult]);

  async function startRun() {
    setBusy(true);
    try { setError(''); setJob(await api.runFullNotebook()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start full-cohort run'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span>{loaded ? `${loaded.n_records.toLocaleString()} users · Pair B research` : 'Saved full-cohort results'}</span>
      <button type="button" disabled={busy} className="btn-muted" onClick={() => void refresh()}>{busy ? 'Loading…' : 'Reload saved results'}</button>
    </div>
    <p className="text-xs text-slate-600">A new full-cohort run follows the recorded methodology and saves results separately from the reference data.</p>
    <button type="button" disabled={busy || !readiness?.ready || job?.status === 'queued' || job?.status === 'running'}
      className="btn-muted" onClick={() => void startRun()}>Run full-cohort analysis (6,040 users)</button>
    {readiness && !readiness.ready && <p className="text-xs text-amber-700">Rerun unavailable until the upstream SASRec model and processed dataset are installed. Missing: {readiness.missing_files.join(' · ')}</p>}
    {job && <div role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <strong>{job.status}</strong> · {job.detail ?? ''} {typeof job.progress === 'number' ? `${job.progress}%` : ''}
      {job.error && <p className="mt-1 text-red-700">{job.error}</p>}
      {job.status === 'complete' && <p className="mt-1 text-teal-800">Generated results loaded above. The reference results remain available through Reload saved results.</p>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
