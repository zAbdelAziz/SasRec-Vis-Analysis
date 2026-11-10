import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ResearchMarkdown from './ResearchMarkdown';
import type { NotebookNotes, NotebookPrompts } from '../types/api';

export default function ResearchMaterials() {
  const [notes, setNotes] = useState<NotebookNotes | null>(null);
  const [prompts, setPrompts] = useState<NotebookPrompts | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void api.notebookNotes().then(setNotes).catch((cause: Error) => setError(cause.message));
  }, []);
  async function openPrompts() {
    setShowPrompts(true);
    if (prompts) return;
    try { setPrompts(await api.notebookPrompts()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load the prompt record'); }
  }
  return <>
    <section className="surface min-w-0 p-4 lg:p-5" aria-label="Research notes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Research notes</h2>
          <p className="text-xs text-slate-500">Methodology, limitations, and interpretation</p>
        </div>
        <button className="btn-muted" type="button" onClick={() => void openPrompts()}>Phase I Prompts</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="max-h-[30rem] space-y-5 overflow-y-auto pr-2">
        {notes ? notes.cells.map(cell => <div key={cell.index} className="border-b border-slate-100 pb-4 last:border-0">
          <ResearchMarkdown markdown={cell.markdown} />
        </div>) : <p className="text-sm text-slate-500">Loading research notes…</p>}
      </div>
    </section>
    {showPrompts && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-7" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPrompts(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="prompts-title" className="surface flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden p-4 lg:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 id="prompts-title" className="text-lg font-bold">Phase I Prompts</h2>
            <p className="text-xs text-slate-500">AI interaction record · Phase I</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-muted" disabled={!prompts} onClick={() => {
              if (prompts) void navigator.clipboard.writeText(prompts.markdown).then(() => setCopied(true)).catch(() => setError('Unable to copy text'));
            }}>{copied ? 'Copied' : 'Copy full text'}</button>
            <button type="button" className="btn-muted" onClick={() => setShowPrompts(false)}>Close</button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <nav aria-label="Prompt entries" className="flex flex-wrap gap-2 border-b border-slate-100 pb-2 md:w-40 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:pr-3">
            {([1, 2, 3, 4, 5] as const).map(entry => <button type="button" key={entry} className="rounded-lg px-2 py-1 text-left text-xs text-teal-700 hover:bg-teal-50"
              onClick={() => document.getElementById(`prompt-entry-${entry}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
              Entry {entry}
            </button>)}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {prompts ? <ResearchMarkdown markdown={prompts.markdown} /> : <p className="text-sm text-slate-500">Loading prompts…</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </section>
    </div>}
  </>;
}
