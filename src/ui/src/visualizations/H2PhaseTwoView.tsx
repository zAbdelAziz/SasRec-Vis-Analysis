import { useState } from 'react';
import type { Data } from 'plotly.js';
import PlotFrame from '../components/PlotFrame';
import { num, str } from '../lib/records';
import { MovieLists } from './H2MovieLists';
import type { VizProps } from './types';

type DecadeRow = {
  user_id: number; decade: string; candidate_count: number;
  mean_cosine: number; mean_score: number; mean_embedding_norm: number;
};
const decadeYear = (value: string) => Number(value.replace(/s$/, ''));
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;

export default function H2PhaseTwoView({ result }: VizProps) {
  const allGeometry = (result.views.geometry ?? []) as DecadeRow[];
  const savedUsers = [...new Set(allGeometry.map((row) => row.user_id))].sort((a, b) => a - b);
  const [selectedId, selectUser] = useState<number | null>(null);
  const [selectedDecade, selectDecade] = useState<string>('');
  const user = selectedId != null && savedUsers.includes(selectedId) ? selectedId : savedUsers[0];
  const geometry = allGeometry.filter((row) => row.user_id === user)
    .sort((a, b) => decadeYear(a.decade) - decadeYear(b.decade));
  const total = geometry.reduce((sum, row) => sum + row.candidate_count, 0);
  const overallScore = total ? geometry.reduce((sum, row) => sum + row.candidate_count * row.mean_score, 0) / total : 0;
  const decade = geometry.some((row) => row.decade === selectedDecade) ? selectedDecade : '';
  const selected = geometry.find((row) => row.decade === decade);
  const example = result.examples.find((row) => num(row, 'user_id') === user);
  const recent = result.records.find((row) => num(row, 'user_id') === user && str(row, 'window') === 'recent');
  const scoreAdvantage = geometry.map((row) => row.mean_score - overallScore);
  if (!geometry.length) return <div className="surface p-5 text-sm text-slate-600">There are no saved internal decade measurements for this research pair. Run H2 Phase II to calculate them.</div>;
  const choices = geometry.map((row) => row.decade);
  const choose = (value: unknown) => { const label = String(value ?? ''); if (choices.includes(label)) selectDecade(label); };
  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <h2 className="text-base font-bold text-slate-900">How do learned representations relate to movie release decades?</h2>
      <p className="mt-1 text-xs text-slate-600">Left: direction of learned movie embeddings relative to the selected user's contextual representation. Right: dot-product ranking scores relative to that user's average eligible candidate.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700">
        <label className="flex items-center gap-2 font-semibold">User <select className="field py-1.5 text-xs" value={user} onChange={(e) => { selectUser(Number(e.target.value)); selectDecade(''); }}>
          {savedUsers.map((id) => <option key={id} value={id}>User {id}</option>)}
        </select></label>
        <span><strong>{savedUsers.length}</strong> users have saved internal analysis</span>
        <span><strong>{total.toLocaleString()}</strong> eligible movies with known years</span>
        {recent && <span>History <strong>{num(recent, 'history_mean_year').toFixed(1)}</strong> → recommendations <strong>{num(recent, 'recommendation_mean_year').toFixed(1)}</strong> (mean release year)</span>}
      </div>
    </div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Embedding alignment by release decade" height={390}
        note="Mean cosine similarity between the user representation and eligible movie embeddings. Negative and positive values are possible; an isolated decade may contain very few movies."
        data={[{ type: 'scatter', mode: 'markers', name: 'Mean cosine similarity',
          x: choices, y: geometry.map((row) => row.mean_cosine),
          customdata: geometry.map((row) => row.decade),
          text: geometry.map((row) => `${row.candidate_count} eligible movies<br>Mean embedding norm: ${row.mean_embedding_norm.toFixed(3)}`),
          marker: { color: geometry.map((row) => row.decade === decade ? '#ea580c' : '#0f766e'),
            size: geometry.map((row) => row.decade === decade ? 14 : 10), symbol: 'circle' },
          hovertemplate: '%{x}<br>Mean cosine: %{y:.4f}<br>%{text}<extra></extra>' } as Data]}
        layout={{ xaxis: { title: { text: 'Movie release decade' }, categoryorder: 'array', categoryarray: choices, tickangle: -35 },
          yaxis: { title: { text: 'Mean cosine similarity' }, zeroline: true, zerolinecolor: '#94a3b8' },
          margin: { l: 74, b: 80, t: 16, r: 26 } }}
        onPoint={(point) => choose(point.x)} />
      <PlotFrame title="Ranking-score advantage by decade" height={390}
        note="Difference from the candidate-count-weighted mean score of this user's eligible known-year movies. Scores are not probabilities; positive means above that reference."
        data={[{ type: 'bar', name: 'Difference from eligible mean',
          x: choices, y: scoreAdvantage,
          customdata: choices,
          text: geometry.map((row) => `${row.candidate_count} eligible movies<br>Raw mean score: ${row.mean_score.toFixed(4)}`),
          marker: { color: geometry.map((row, index) => row.decade === decade ? '#f59e0b' : scoreAdvantage[index] >= 0 ? '#0f766e' : '#b45309'),
            line: { width: geometry.map((row) => row.decade === decade ? 2 : 0), color: '#1e293b' } },
          hovertemplate: '%{x}<br>Score advantage: %{y:+.4f}<br>%{text}<extra></extra>' } as Data]}
        layout={{ xaxis: { title: { text: 'Movie release decade' }, categoryorder: 'array', categoryarray: choices, tickangle: -35 },
          yaxis: { title: { text: 'Score minus eligible-catalog mean' }, zeroline: true, zerolinecolor: '#475569' },
          margin: { l: 90, b: 80, t: 16, r: 26 } }}
        onPoint={(point) => choose(point.x)} />
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="font-bold">Inspect one release decade</h3>
        <label className="text-xs font-semibold">Decade <select className="field mt-1" value={decade} onChange={(e) => selectDecade(e.target.value)}>
          <option value="">Choose a decade…</option>{geometry.map((row) => <option key={row.decade} value={row.decade}>{row.decade}</option>)}
        </select></label>
      </div>
      {selected ? <p className="mt-2 text-xs leading-relaxed">{selected.decade}: <strong>{selected.candidate_count}</strong> eligible movies; mean cosine <strong>{selected.mean_cosine.toFixed(4)}</strong>; raw ranking score <strong>{selected.mean_score.toFixed(4)}</strong>; score advantage <strong>{signed(selected.mean_score - overallScore)}</strong>; mean embedding norm <strong>{selected.mean_embedding_norm.toFixed(3)}</strong>.</p> :
        <p className="mt-2 text-xs text-slate-500">Select the same decade in either chart to inspect both internal measurements together.</p>}
      <p className="mt-2 text-xs text-slate-500">The two charts use the same eligible known-year movies for each decade, not only top-ranked recommendations. More alignment does not necessarily imply higher ranking scores, because dot products also depend on vector lengths. Associations with release decade are not causal effects.</p>
    </section>
    {example && <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Actual historical and recommended movies for user {user}</summary>
      <div className="mt-4"><MovieLists example={example} window="recent" /></div>
    </details>}
  </div>;
}
