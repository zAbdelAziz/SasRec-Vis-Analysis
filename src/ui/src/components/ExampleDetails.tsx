import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RawRow, MovieDetails } from '../types/api';
import { arrayNum, asRows, entries, formatNum, num, rows, str } from '../lib/records';
import PlotFrame from './PlotFrame';
import RankComparison from './RankComparison';
import SwapStory from './SwapStory';

const historyFields = [
  ['history', 'Interaction history'], ['history_a', 'User A history'],
  ['history_b', 'User B history'], ['history_low', 'Low-rated history'],
  ['history_high', 'High-rated history'], ['original', 'Original history'], ['modified', 'Modified history'],
];

function AttributionCard({ title, source }: { title: string; source: unknown }) {
  const target = source && typeof source === 'object' ? source as RawRow : {};
  const values = asRows(target, 'effects');
  if (!values.length) return null;
  return <PlotFrame title={title} note={`Score change after removing a historical item; candidate #${str(target, 'candidate')}. Deletion shifts positions.`}
    data={[{ type: 'bar', x: values.map((v) => num(v, 'position')),
      y: values.map((v) => num(v, 'score_delta')), marker: { color: '#0f766e' } }]}
    layout={{ xaxis: { title: { text: 'History position (from end)' } },
      yaxis: { title: { text: 'Score change' } } }} height={270} />;
}

export default function ExampleDetails({ example, phase }: { example: RawRow | null; phase?: 1 | 2 }) {
  const [metadata, setMetadata] = useState<MovieDetails | null>(null);
  const key = example ? str(example, 'example_id') : '';
  useEffect(() => {
    setMetadata(null);
    if (!example) return;
    const ids = [...new Set([
      ...historyFields.flatMap(([field]) => arrayNum(example[field])).slice(-70),
      ...rows(example.recommendations).map((item) => num(item, 'item_id')),
      ...rows(example.ranking_before).map((item) => num(item, 'item_id')),
      ...rows(example.ranking_after).map((item) => num(item, 'item_id')),
    ])];
    if (!ids.length) return;
    let mounted = true;
    const chunks = Array.from({ length: Math.ceil(ids.length / 70) }, (_, i) => ids.slice(i * 70, (i + 1) * 70));
    void Promise.all(chunks.map((chunk) => api.movieDetails(chunk))).then((parts) => {
      if (mounted) setMetadata({ verified: parts.every((part) => part.verified), items: parts.flatMap((part) => part.items) });
    }).catch(() => {});
    return () => { mounted = false; };
  }, [example]);
  if (!example) return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
    Select a chart point or a saved case to inspect the underlying movie histories and predictions.
  </div>;
  const names = new Map((metadata?.items ?? []).map((movie) => [movie.item_id, movie.title]));
  const hasSwap = phase === 1 && arrayNum(example.original).length > 0 && arrayNum(example.modified).length > 0;
  const before = rows(example.ranking_before ?? example.recommendations_low);
  const after = rows(example.ranking_after ?? example.recommendations_high);
  const representation = (example.representation ?? {}) as RawRow;
  const geometry = (example.embedding_geometry ?? {}) as RawRow;
  const diagnostics = rows(example.group_diagnostics);
  const similarities = arrayNum(representation.layer_cosines);
  return <section className="space-y-4 rounded-2xl border border-teal-200 bg-[#f6fbfa] p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-slate-900">Selected case · {key}</h3>
      <span className="text-xs text-slate-600">{metadata?.verified ? 'Verified movie titles' : 'Internal movie IDs only'}</span></div>
    {hasSwap && <SwapStory example={example} names={names} />}
    <div className="grid gap-3 lg:grid-cols-2">
      {historyFields.filter(([field]) => !(hasSwap && (field === 'original' || field === 'modified')) && arrayNum(example[field]).length).map(([field, label]) => (
        <div key={field} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h4 className="mb-2 text-xs font-bold text-slate-700">{label}</h4>
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {arrayNum(example[field]).slice(-30).map((item, index) => <span key={`${item}-${index}`}
              title={names.get(item) ?? `SASRec internal item #${item}`}
              className="max-w-full truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
              {names.get(item) ?? `#${item}`}</span>)}
          </div>
        </div>))}
    </div>
    {rows(example.recommendations).length > 0 && <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h4 className="text-xs font-bold text-slate-700">Ranked recommendations</h4>
      {example.context_length !== undefined && <p className="mt-1 text-xs text-slate-500">
        {num(example, 'context_length')} movies in the model context; showing the latest 30 history movies above.
      </p>}
      <ol className="mt-2 grid max-h-64 list-inside list-decimal gap-1 overflow-y-auto text-xs text-slate-700 md:grid-cols-2">
        {rows(example.recommendations).map((item) => <li key={num(item, 'item_id')} value={num(item, 'rank')}>
          {names.get(num(item, 'item_id')) ?? `#${num(item, 'item_id')}`}
          <span className="ml-2 text-slate-500">{metadata?.items.find((movie) => movie.item_id === num(item, 'item_id'))?.genres.join(' · ')}</span>
        </li>)}
      </ol>
    </div>}
    {before.length > 0 && after.length > 0 && <RankComparison left={{items: before}} right={{items: after}} names={names} readable={hasSwap} />}
    {similarities.length > 0 && <PlotFrame title="Intermediate-layer representation similarity" note="Compare hidden-state similarities across matched or modified sequences."
      data={[{ type: 'scatter', mode: 'lines+markers', x: similarities.map((_, i) => i+1), y: similarities,
        marker: { color: '#0f766e' } }]}
      layout={{ xaxis: { title: { text: 'Layer' }, dtick: 1 }, yaxis: { title: { text: 'Cosine similarity' }, range: [-1,1] } }} height={260} />}
    <div className="grid gap-3 xl:grid-cols-2">
      {(['attribution', 'attribution_a', 'attribution_b', 'attribution_before', 'attribution_after',
         'attribution_original', 'attribution_modified'] as const).map((name) => <AttributionCard key={name} title={name.replace(/_/g, ' ')} source={example[name]} />)}
      {diagnostics.map((diagnostic) => <AttributionCard key={str(diagnostic, 'group')} title={`${str(diagnostic, 'group')} rating group influence`} source={diagnostic.attribution} />)}
    </div>
    {rows(geometry.historical_relationships).length > 0 && <PlotFrame title="Historical item relation to candidate embeddings"
      note="Mean cosine similarity to top candidate vectors; descriptive only."
      data={[{ type: 'bar', x: asRows(geometry, 'historical_relationships').map((r) => num(r, 'position')),
        y: asRows(geometry, 'historical_relationships').map((r) => num(r, 'mean_candidate_cosine')) }]}
      layout={{ xaxis: { title: { text: 'Historical position' } }, yaxis: { title: { text: 'Mean embedding cosine' } } }} height={270} />}
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {['rank_change', 'context_cosine', 'older_distance', 'low_exposure', 'high_exposure',
        'difference_low_minus_high', 'popularity', 'final_state_cosine'].filter((field) => example[field] !== undefined)
        .map((field) => <span key={field} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          <strong>{field.replace(/_/g, ' ')}:</strong> {formatNum(num(example, field))}</span>)}
      {entries(example.old_genres).slice(0, 3).map(([genre, weight]) => <span key={genre} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">Older: {genre} {formatNum(weight)}</span>)}
    </div>
  </section>;
}
