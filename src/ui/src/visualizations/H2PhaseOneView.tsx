import { useEffect, useState } from 'react';
import type { Data } from 'plotly.js';
import PlotFrame from '../components/PlotFrame';
import { useAnalysisStore } from '../store/useAnalysisStore';
import ResearchQuestionHeader from '../components/ResearchQuestionHeader';
import { MovieLists } from './H2MovieLists';
import { entries, mean, num, str, unique } from '../lib/records';
import { relativeYearLabel, CHANGE_COLORS } from '../lib/visualizationData';
import type { VizProps } from './types';

const year = (value: unknown) => value == null ? 'Unknown' : Number(value).toFixed(1);

export default function H2PhaseOneView({ result, scope, onPick }: VizProps) {
  const [reference, setReference] = useState<'recent' | 'context'>('recent');
  const [sortMode, setSortMode] = useState<'historical' | 'magnitude'>('historical');
  const [userId, setUserId] = useState<number | null>(null);
  const filters = useAnalysisStore((state) => state.filters[scope]);
  const setFilter = useAnalysisStore((state) => state.setFilter);
  const selectedSaved = useAnalysisStore((state) => state.selections[scope]);
  useEffect(() => {
    const found = result.examples.find((example) => str(example, 'example_id') === selectedSaved);
    if (found) setUserId(num(found, 'user_id'));
  }, [selectedSaved, result]);

  const records = result.records.filter((record) => str(record, 'window') === reference &&
    (!filters?.era || filters.era === 'all' || str(record, 'history_mean_decade') === filters.era) &&
    (!filters?.genre || filters.genre === 'all' || (record.dominant_genres as string[]).includes(filters.genre)))
    .sort((a, b) => sortMode === 'magnitude' ? Math.abs(num(b, 'shift_years')) - Math.abs(num(a, 'shift_years')) || num(a, 'user_id') - num(b, 'user_id') :
      num(a, 'history_mean_year') - num(b, 'history_mean_year') || num(a, 'user_id') - num(b, 'user_id'));
  // Keep the detail chart populated on first load; prefer a saved example for movie drill-down.
  const selected = records.find((record) => num(record, 'user_id') === userId) ??
    records.find((record) => result.examples.some((ex) => num(ex, 'user_id') === num(record, 'user_id'))) ?? records[0];
  const example = selected ? result.examples.find((record) => num(record, 'user_id') === num(selected, 'user_id')) : undefined;
  const ids = records.map((record) => num(record, 'user_id'));
  const activeId = selected ? num(selected, 'user_id') : null;
  const labels = records.map((record) => `User ${num(record, 'user_id')}`);
  const plottedYears = records.flatMap((record) => [num(record, 'history_mean_year'), num(record, 'recommendation_mean_year')]);
  const newer = records.filter((record) => num(record, 'shift_years') > 0).length;
  const average = mean(records.map((record) => num(record, 'shift_years')));
  const decades = selected ? unique(['history_decades','recommendation_decades','catalog_decades']
    .flatMap((name) => entries(selected[name]).map(([value]) => value))).sort((a,b) => Number(a) - Number(b)) : [];

  function pick(id: number) {
    setUserId(id);
    const record = records.find((row) => num(row, 'user_id') === id);
    if (record) onPick(record, ['user_id']);
  }
  const arrows: Data[] = records.length ? [
    { type: 'scatter', mode: 'lines', name: 'Shift', showlegend: false, hoverinfo: 'skip',
      x: records.flatMap((record) => [num(record, 'history_mean_year'), num(record, 'recommendation_mean_year'), null]),
      y: labels.flatMap((label) => [label,label,null]), line: { color: '#94a3b8', width: 2 } },
    { type: 'scatter', mode: 'markers', name: 'History', x: records.map((record) => num(record, 'history_mean_year')),
      y: labels, customdata: ids, marker: { color: CHANGE_COLORS.baseline, size: ids.map((id) => id === activeId ? 12 : 8) },
      hovertemplate: '%{y}<br>History average: %{x:.1f}<extra></extra>' },
    { type: 'scatter', mode: 'markers', name: 'Recommendations', x: records.map((record) => num(record, 'recommendation_mean_year')),
      y: labels, customdata: ids, text: records.map((record) => relativeYearLabel(num(record, 'shift_years'))),
      marker: { color: records.map((record) => num(record, 'shift_years') >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease),
        symbol: records.map((record) => num(record, 'shift_years') >= 0 ? 'triangle-right' : 'triangle-left'),
        size: ids.map((id) => id === activeId ? 15 : 10) },
      hovertemplate: '%{y}<br>Recommendation average: %{x:.1f}<br>%{text}<extra></extra>' },
  ] : [];

  return <div className="space-y-4">
    <ResearchQuestionHeader question="Does SASRec recommend movies from newer release years?"
      explanation="Compare the average release years of a user's history and recommendations, then inspect the selected user's release-decade mix."
      readingHint="Gray dot = history average; teal/right or orange/left triangle = recommendation average. The right chart shows which decades contributed." />
    <div className="surface flex flex-wrap items-end gap-2 px-3 py-3 xl:flex-nowrap xl:gap-3" aria-label="Release-year exploration controls">
      <label className="min-w-[140px] flex-[1_1_160px] text-[11px] font-semibold text-slate-600 xl:flex-[0_1_195px]">
        History window
        <select className="field mt-1 py-1.5 text-xs" value={reference} onChange={(event) => { setReference(event.target.value as typeof reference); setFilter(scope, 'era', 'all'); }}
          title="Changes the historical reference, not SASRec recommendations">
          <option value="recent">Latest 20 movies</option>
          <option value="context">Model context (up to {String(result.views.maxlen)})</option>
        </select>
      </label>
      <label className="min-w-[145px] flex-[1_1_180px] text-[11px] font-semibold text-slate-600 xl:flex-[0_1_200px]">
        Sort users
        <select className="field mt-1 py-1.5 text-xs" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
          <option value="historical">Historical release year</option>
          <option value="magnitude">Largest shift</option>
        </select>
      </label>
      <label className="min-w-[125px] flex-[1_1_155px] text-[11px] font-semibold text-slate-600 xl:flex-[0_1_170px]">
        History decade
        <select className="field mt-1 py-1.5 text-xs" value={filters?.era ?? 'all'} onChange={(event) => setFilter(scope, 'era', event.target.value)}>
          <option value="all">All decades</option>
          {unique(result.records.filter((record) => str(record, 'window') === reference).map((record) => str(record, 'history_mean_decade'))).map((decade) =>
            <option key={decade} value={decade}>{decade}</option>)}
        </select>
      </label>
      <label className="min-w-[145px] flex-[1_1_170px] text-[11px] font-semibold text-slate-600 xl:flex-[0_1_185px]">
        Main genre
        <select className="field mt-1 py-1.5 text-xs" value={filters?.genre ?? 'all'} onChange={(event) => setFilter(scope, 'genre', event.target.value)}>
          <option value="all">All genres</option>
          {unique(result.records.flatMap((record) => (record.dominant_genres as string[]) ?? [])).map((genre) =>
            <option key={genre} value={genre}>{genre}</option>)}
        </select>
      </label>
      <div className="flex min-w-0 flex-[1_1_350px] flex-wrap items-center justify-start gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 sm:gap-x-4 xl:justify-end xl:border-l xl:border-t-0 xl:py-1 xl:pl-4" aria-live="polite">
        <span className="whitespace-nowrap"><strong className="text-slate-900">{records.length}</strong> users</span>
        <span className="whitespace-nowrap"><strong className="text-teal-800">{records.length ? `${newer}/${records.length}` : '-'}</strong> newer</span>
        <span className="whitespace-nowrap"><strong className="text-slate-900">{records.length ? `${average > 0 ? '+' : ''}${average.toFixed(1)} yrs` : '-'}</strong> mean shift</span>
      </div>
    </div>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="min-w-0 max-h-[740px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
        <PlotFrame title="Average release-year shift by user"
          note="Select a dot or arrow to inspect the release-decade mix on the right. Scroll within the chart to see every user."
          data={arrows} height={Math.max(360, records.length * 26 + 135)}
          layout={{ xaxis: { title: { text: 'Average movie release year' }, side: 'top', tickformat: 'd',
            range: plottedYears.length ? [Math.min(...plottedYears) - 3, Math.max(...plottedYears) + 3] : undefined },
            yaxis: { categoryorder: 'array', categoryarray: labels, autorange: 'reversed', dtick: 1 },
            margin: { l: 87, r: 18, b: 20, t: 65 }, showlegend: false }}
          onPoint={(point) => { if (point.customdata !== undefined) pick(Number(point.customdata)); }} />
      </div>
      <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Release-decade distribution</h3>
            <p className="mt-1 text-xs text-slate-500">History · recommendations · eligible catalog</p>
          </div>
          <label className="text-xs font-semibold text-slate-700">Selected user
            <select className="field mt-1 max-w-56" value={selected ? String(activeId) : ''} onChange={(event) => event.target.value && pick(Number(event.target.value))}>
              <option value="">Select user…</option>
              {records.map((record) => <option key={num(record, 'user_id')} value={num(record, 'user_id')}>
                User {num(record, 'user_id')}{result.examples.some((ex) => num(ex, 'user_id') === num(record, 'user_id')) ? ' · movies saved' : ''}
              </option>)}
            </select>
          </label>
        </div>
        {selected ? <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>History <strong className="text-slate-900">{year(selected.history_mean_year)}</strong></span>
            <span>Recommendations <strong className="text-slate-900">{year(selected.recommendation_mean_year)}</strong></span>
            <span>Available <strong className="text-slate-900">{year(selected.catalog_mean_year)}</strong></span>
          </div>
          <PlotFrame title="Share of movies released in each decade"
            note="Percentages use movies with known years. The available catalog is context, not a causal explanation."
            data={[
              ['history_decades', 'History', CHANGE_COLORS.baseline],
              ['recommendation_decades', 'Recommendations', CHANGE_COLORS.increase],
              ['catalog_decades', 'Available catalog', '#d6a45b'],
            ].map(([field,name,color]) => ({ type: 'bar', name, x: decades.map((decade) => `${decade}s`),
              y: decades.map((decade) => new Map(entries(selected[field])).get(decade) ?? 0),
              marker: { color }, textposition: 'none' })) as Data[]}
            height={385}
            layout={{ barmode: 'group', xaxis: { title: { text: 'Release decade' }, tickangle: -35 },
              yaxis: { title: { text: 'Share of known-year movies' }, tickformat: '.0%' },
              legend: { orientation: 'h', y: 1.17 }, margin: { l: 70, r: 14, t: 50, b: 72 } }} />
          <p className="text-xs text-slate-600">Known years: history {num(selected, 'history_known')}/{num(selected, 'window_length')}; recommendations {num(selected, 'recommendation_known')}/{num(selected, 'recommendation_count')}; catalog {num(selected, 'candidate_known')}/{num(selected, 'candidate_count')}. Popular-unseen reference: {year(selected.popular_mean_year)}.</p>
        </> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No user matches the selected filters.</p>}
      </section>
    </div>

    {(Number(result.views.skipped_users) > 0 || Number(result.views.catalog_missing_years) > 0) && <p className="text-xs text-slate-500">
      Data coverage: {String(result.views.catalog_missing_years)} catalog movies with unknown release year, {String(result.views.skipped_users)} sampled users not comparable. Unknown years are excluded.
    </p>}
    {selected && <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-bold text-slate-900">Movies behind user {activeId}'s comparison</h3>
      {example ? <MovieLists example={example} window={reference} /> : <p className="text-sm text-slate-600">Averages are available for this user, but individual movie titles were not saved. Choose a user marked “movies saved” to inspect the lists.</p>}
    </section>}
  </div>;
}
