import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { hypotheses, hypothesisGroups } from '../content/hypotheses';
import { api } from '../api/client';
import type { LayoutContext } from '../components/Layout';

export default function HomePage() {
  const { status, refresh } = useOutletContext<LayoutContext>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const model = status?.model;
  const dataset = status?.dataset;

  async function reloadModel() {
    setBusy(true);
    setError('');
    try { await api.loadModel(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reload the checkpoint'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <header>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Understanding SASRec recommendations</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Explore how a sequential movie recommender behaves (Phase I) and what it learned (Phase II), using MovieLens-1M.
      </p>
    </header>

    <section aria-label="AI assistance by research pair" className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="font-semibold text-slate-900">Pair A</div>
        <p className="mt-1 text-slate-600"><strong>Phase I:</strong> No AI assistance <span className="mx-1 text-slate-300">·</span> <strong>Phase II:</strong> AI assistance</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="font-semibold text-slate-900">Pair B</div>
        <p className="mt-1 text-slate-600"><strong>Phase I:</strong> AI assistance <span className="mx-1 text-slate-300">·</span> <strong>Phase II:</strong> No AI assistance</p>
        <p className="mt-1 text-xs text-slate-500">Only Phase I investigations are currently available for Pair B.</p>
      </div>
    </section>

    <section aria-label="Investigations">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Investigations</h2>
      {hypothesisGroups.map(group => <div key={group.id} className="mb-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{group.label}</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hypotheses.filter(hypothesis => hypothesis.group === group.id).map(hypothesis => <Link
            to={`/hypotheses/${hypothesis.id}`} key={hypothesis.id}
            className="surface group p-4 transition hover:border-teal-300">
            <div className="text-xs font-semibold text-teal-700">Hypothesis {Number(hypothesis.accent)}</div>
            <h4 className="mt-1 font-semibold text-slate-900 group-hover:text-teal-800">{hypothesis.short}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{hypothesis.question}</p>
          </Link>)}
        </div>
      </div>)}
    </section>

    <section aria-label="Data and model status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
      <span className="font-semibold text-slate-600">Data &amp; model</span>
      <span>{dataset?.users?.toLocaleString() ?? '-'} users</span>
      <span>{dataset?.items?.toLocaleString() ?? '-'} movies</span>
      <span>{dataset?.interactions?.toLocaleString() ?? '-'} interactions</span>
      <span>Metadata: <strong className={dataset?.id_mapping === 'verified' ? 'text-emerald-700' : 'text-amber-700'}>{dataset?.id_mapping ?? 'unknown'}</strong></span>
      <span className={model?.ready ? 'text-emerald-700' : 'text-amber-700'}>{model?.ready ? 'Model ready' : 'Model not ready'}</span>
      <div className="flex items-center gap-3 lg:ml-auto">
        <button type="button" onClick={() => void refresh()} className="underline underline-offset-2 hover:text-slate-900">Refresh status</button>
        {model?.checkpoint_found && <button type="button" disabled={busy} onClick={() => void reloadModel()}
          className="underline underline-offset-2 hover:text-slate-900">{busy ? 'Loading…' : 'Reload checkpoint'}</button>}
      </div>
      {(error || model?.error) && <p role="alert" className="w-full text-xs text-red-700">{error || model?.error}</p>}
    </section>
  </div>;
}
