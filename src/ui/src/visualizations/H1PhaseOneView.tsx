import { useState } from 'react';
import ResearchQuestionHeader from '../components/ResearchQuestionHeader';
import InsightSummary from '../components/InsightSummary';
import MovieList, { type Movie } from '../components/MovieList';
import DivergingBarChart from '../components/charts/DivergingBarChart';
import GenreDumbbellChart from '../components/charts/GenreDumbbellChart';
import { rows, num, str } from '../lib/records';
import { asPercentagePoints, meanOf, ppValueLabel } from '../lib/visualizationData';
import type { VizProps } from './types';

export default function H1PhaseOneView({ result }: VizProps) {
  const users = rows(result.views.users);
  const dominant = rows(result.views.dominant);
  const genres = (result.views.genres as string[]) ?? [];
  const [chosenId, setChosenId] = useState('');
  const [chosenGenre, setChosenGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<'difference' | 'magnitude' | 'user'>('difference');
  const [showAll, setShowAll] = useState(false);
  if (!users.length || !dominant.length) return <p className="surface p-4">No eligible users or genre comparisons were saved for this run.</p>;
  const options = dominant.map((r) => ({ userId: str(r, 'user_id'), genre: str(r, 'genre'),
    historyShare: num(r, 'history_share'), recommendationShare: num(r, 'recommendation_share'),
    differencePp: asPercentagePoints(num(r, 'amplification')) }));
  options.sort((a, b) => sort === 'magnitude' ? Math.abs(b.differencePp) - Math.abs(a.differencePp) :
    sort === 'user' ? Number(a.userId) - Number(b.userId) : b.differencePp - a.differencePp);
  const user = users.find((r) => str(r, 'user_id') === chosenId) ?? users[0];
  const userId = str(user, 'user_id');
  const hp = user.history_profile as Record<string, number>;
  const rp = user.recommendation_profile as Record<string, number>;
  const changed = genres.map((genre) => ({ genre, history: hp[genre] ?? 0, recommended: rp[genre] ?? 0 }));
  const positives = options.filter((r) => r.differencePp > 0).length;
  const average = meanOf(options.map((r) => r.differencePp));
  return <div className="space-y-5">
    <ResearchQuestionHeader question="Does the model reinforce users' most common movie genres?"
      explanation="We compare the share of each genre in a user's movie history with its share among their top recommendations. A larger share means that genre became more prominent, not necessarily that the recommendations are better."
      readingHint="Bars point right when the user's main genre occupies more of their recommendations; left means less. Differences are measured in percentage points." />
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">Order users by
        <select className="field mt-1" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="difference">Largest increases first</option><option value="magnitude">Largest absolute changes first</option><option value="user">User ID</option>
        </select>
      </label>
          <span className="text-xs text-slate-500">Select a bar or use the chooser on the right.</span>
        </div>
        <DivergingBarChart values={options} selectedId={userId} onSelect={(id) => { setChosenId(id); setChosenGenre(null); }} />
      </div>
      <section className="min-w-0 space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="section-label text-teal-700">Explore one user</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Where did the genre mix change?</h3></div>
        <label className="text-sm font-semibold text-slate-700">User
          <select className="field mt-1" value={userId} onChange={(e) => { setChosenId(e.target.value); setChosenGenre(null); }}>
            {options.map((row) => <option key={row.userId} value={row.userId}>User {row.userId} · {row.genre}</option>)}
          </select>
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Show all {genres.length} genres (default: eight largest changes)
      </label>
      <GenreDumbbellChart items={changed} selectedGenre={chosenGenre} onSelect={setChosenGenre} showAll={showAll} />
      {chosenGenre && <button className="btn-muted text-xs" onClick={() => setChosenGenre(null)}>Clear {chosenGenre} highlighting</button>}
      </section>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <MovieList title="Movies in the history window" movies={(user.history_movies as Movie[]) ?? []} activeGenre={chosenGenre} />
      <MovieList title="Top recommendations" movies={(user.recommendations as Movie[]) ?? []} activeGenre={chosenGenre} />
    </div>
    <InsightSummary metrics={[
      { label: 'Users compared', value: String(options.length), note: 'Sampled users in this run.' },
      { label: 'Main genre became more prominent', value: `${positives} of ${options.length}`, note: 'Based on each user’s most common historical genre.' },
      { label: 'Average change for main genre', value: ppValueLabel(average), note: 'A negative value means less representation on average.' },
    ]} />

  </div>;
}
