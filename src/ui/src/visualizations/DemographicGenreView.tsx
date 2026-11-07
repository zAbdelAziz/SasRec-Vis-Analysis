import { useState } from 'react';
import ResearchQuestionHeader from '../components/ResearchQuestionHeader';
import MovieList, { type Movie } from '../components/MovieList';
import GenreDumbbellChart from '../components/charts/GenreDumbbellChart';
import DemographicBeforeAfterChart, { demographicKey, genderLabel, type DemographicEstimate } from '../components/charts/DemographicBeforeAfterChart';
import GroupGenreChanges from '../components/charts/GroupGenreChanges';
import { percentLabel, ppLabel } from '../lib/visualizationData';
import type { VizProps } from './types';
import type { RawRow } from '../types/api';

type BinSummary = DemographicEstimate & { bin: number };
type User = {
  user_id: number; example_id: string; age_code: string; age_label: string; gender: string;
  history_length: number; history_profile: Record<string, number>; recommendation_profile: Record<string, number>;
  amplification: Record<string, number>; history_movies: Movie[]; recommendations: Movie[];
};

function labelFor(key: string, ages: Record<string, string>) {
  const [ageCode, gender] = key.split('/');
  return `${ages[ageCode] ?? ageCode} · ${genderLabel(gender)}`;
}

/** Research Phase I remains the original age/gender genre representation study. */
export default function DemographicGenreView({ result, onPick }: VizProps) {
  if (result.views.analysis !== 'demographic_genre_amplification') {
    return <p className="surface p-4">This H3 result cannot display the demographic genre comparison. Rerun Phase I to generate compatible results.</p>;
  }
  return <DemographicDashboard result={result} onPick={onPick} />;
}

function DemographicDashboard({ result, onPick }: Pick<VizProps, 'result' | 'onPick'>) {
  const users = result.views.users as User[];
  const groups = result.views.groups as DemographicEstimate[];
  const bins = result.views.preference_bins as BinSummary[];
  const genres = result.views.genres as string[];
  const ages = result.views.ages as Record<string, string>;
  const genders = result.views.genders as string[];
  const binLabels = result.views.bin_labels as string[];
  const [chosenGenre, setChosenGenre] = useState('Drama');
  const [chosenGroup, setChosenGroup] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [chosenUser, setChosenUser] = useState<number | null>(null);
  const [highlightGenre, setHighlightGenre] = useState<string | null>(null);

  const genre = genres.includes(chosenGenre) ? chosenGenre : genres[0];
  const estimates = groups.filter((row) => row.genre === genre);
  const populated = estimates.filter((row) => row.n > 0 && row.mean != null);
  // Always show a meaningful secondary chart: start at the best-supported group.
  // User selection takes priority; no stored selection is needed until an interaction.
  const defaultGroup = [...populated].sort((a, b) => b.n - a.n || demographicKey(a).localeCompare(demographicKey(b)))[0];
  const group = populated.some((row) => demographicKey(row) === chosenGroup)
    ? chosenGroup : defaultGroup ? demographicKey(defaultGroup) : '';
  const selected = populated.find((row) => demographicKey(row) === group);
  const groupLabel = group ? labelFor(group, ages) : 'No group available';
  const sameAgeOtherGender = group
    ? populated.find((row) => row.age_code === selected?.age_code && demographicKey(row) !== group) : undefined;
  const comparisonChoices = populated.filter((row) => demographicKey(row) !== group);
  const comparisonGroup = comparisonChoices.some((row) => demographicKey(row) === compareTo) ? compareTo :
    (sameAgeOtherGender ? demographicKey(sameAgeOtherGender) : comparisonChoices[0] ? demographicKey(comparisonChoices[0]) : '');
  const compareLabel = comparisonGroup ? labelFor(comparisonGroup, ages) : 'No comparison group';
  const groupGenres = groups.filter((row) => demographicKey(row) === group);
  const groupUsers = users.filter((row) => demographicKey(row) === group);
  const individual = groupUsers.find((row) => row.user_id === chosenUser) ?? groupUsers[0];
  const userGenres = individual ? genres.map((name) => ({ genre: name,
    history: individual.history_profile[name] ?? 0, recommended: individual.recommendation_profile[name] ?? 0 })) : [];
  const increases = populated.filter((row) => row.mean! > 0).length;
  const decreases = populated.filter((row) => row.mean! < 0).length;
  // Both facets share the same 0-based horizontal axis for honest comparison.
  const largestShare = Math.max(0.01, ...estimates.flatMap((row) => [row.history_mean, row.recommendation_mean]
    .filter((value): value is number => value != null)));
  const xMax = Math.min(100, Math.max(10, Math.ceil((largestShare * 100 + 4) / 5) * 5));
  const displayGenders = ['M', 'F', ...genders.filter((value) => value !== 'M' && value !== 'F')]
    .filter((value) => genders.includes(value));

  function chooseGenre(value: string) {
    setChosenGenre(value);
    setHighlightGenre(null);
  }
  function chooseGroup(value: string) {
    setChosenGroup(value);
    setChosenUser(null);
    setHighlightGenre(null);
  }
  function chooseUser(value: number) {
    setChosenUser(value);
    const found = groupUsers.find((row) => row.user_id === value);
    if (found && result.examples.some((example) => example.user_id === value)) onPick(found as unknown as RawRow, ['user_id']);
  }
  const matched = binLabels.map((binLabel, index) => ({
    name: binLabel,
    first: bins.find((row) => row.genre === genre && row.bin === index && demographicKey(row) === group),
    second: bins.find((row) => row.genre === genre && row.bin === index && demographicKey(row) === comparisonGroup),
  }));

  return <div className="space-y-4">
    <ResearchQuestionHeader question="Do age and gender groups receive different genre mixes?"
      explanation="Choose a genre to compare its average share in users' histories and recommendations."
      readingHint="Gray circle = history; diamond = recommendations. A shift right means a larger share, left means a smaller share." />

    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <label className="flex items-center gap-3 text-xs font-semibold text-slate-700">Genre
        <select className="field w-48 py-1.5" value={genre} onChange={(event) => chooseGenre(event.target.value)}>
          {genres.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>{users.length} users</span>
        <span><strong className="text-teal-700">{increases}</strong> groups increased</span>
        <span><strong className="text-amber-700">{decreases}</strong> decreased</span>
        <span className="text-slate-400">Same scale · select an age group to inspect</span>
      </div>
    </div>

    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)]">
      <section className="min-w-0 space-y-3" aria-label="Genre share by gender and age">
        {displayGenders.map((gender) => <DemographicBeforeAfterChart key={gender} gender={gender}
          ages={ages} estimates={estimates} genre={genre} xMax={xMax}
          selectedGroup={group} onSelect={chooseGroup} />)}
      </section>

      <section className="min-w-0 space-y-3" aria-label="Selected group's genre changes">
        {selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Selected age / gender group</p>
              <h3 className="text-sm font-bold text-slate-900">{groupLabel}</h3>
            </div>
            <p className="text-xs text-slate-700">{genre}: <strong>{ppLabel(selected.mean)}</strong> · {selected.n} users</p>
          </div>
          <GroupGenreChanges groupLabel={groupLabel} estimates={groupGenres} selectedGenre={genre} onGenre={chooseGenre} />
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            {genre} share: {selected.history_mean == null ? '-' : percentLabel(selected.history_mean)} in history → {selected.recommendation_mean == null ? '-' : percentLabel(selected.recommendation_mean)} in recommendations.
            {' '}95% interval for the change: {selected.ci_low == null || selected.ci_high == null ? 'not available' : `${ppLabel(selected.ci_low)} to ${ppLabel(selected.ci_high)}`}.
            {selected.n < 5 ? ' Small group; interpret cautiously.' : ''}
          </p>
        </> : <p className="surface p-5 text-sm text-slate-600">No observations for this genre.</p>}
      </section>
    </div>

    {selected && <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2">
      <details className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">See actual movie examples from {groupLabel}</summary>
        {individual ? <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Person to inspect
            <select className="field mt-1 block max-w-sm" value={individual.user_id} onChange={(event) => chooseUser(Number(event.target.value))}>
              {groupUsers.map((row) => <option key={row.user_id} value={row.user_id}>User {row.user_id}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-600">User {individual.user_id} · {individual.history_length} training interactions, with {individual.history_movies.length} movies in the comparison window. Eight largest genre changes shown below.</p>
          <GenreDumbbellChart items={userGenres} selectedGenre={highlightGenre ?? genre} onSelect={setHighlightGenre} showAll={false} />
          <div className="grid gap-3 2xl:grid-cols-2">
            <MovieList title="Movies in history" movies={individual.history_movies} activeGenre={highlightGenre ?? genre} />
            <MovieList title="Recommended movies" movies={individual.recommendations} activeGenre={highlightGenre ?? genre} />
          </div>
        </div> : <p className="mt-3 text-sm text-slate-600">There are no saved users for this group.</p>}
      </details>

      <details className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Advanced: compare groups with similar starting preferences</summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Compare <strong>{groupLabel}</strong> with another group among users who started with a similar share of <strong>{genre}</strong>. The bins do not match full histories.</p>
          {comparisonGroup ? <>
            <label className="block text-sm font-medium text-slate-700">Second group
              <select className="field mt-1 block max-w-sm" value={comparisonGroup} onChange={(event) => setCompareTo(event.target.value)}>
                {comparisonChoices.map((row) => <option key={demographicKey(row)} value={demographicKey(row)}>{labelFor(demographicKey(row), ages)}</option>)}
              </select>
            </label>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50"><tr><th className="p-3">Starting {genre} share</th><th className="p-3">{groupLabel}</th><th className="p-3">{compareLabel}</th></tr></thead>
                <tbody>{matched.map(({ name, first, second }) => <tr key={name} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{name}</td>
                  {[first,second].map((row, i) => <td key={i} className="p-3">{!row || row.n < 5 || row.sparse || row.mean == null ? `Insufficient data (n=${row?.n ?? 0})` : `${ppLabel(row.mean)} (n=${row.n})`}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Only bins with at least five users in both groups support a comparison. Matching a genre-share bin is not a causal adjustment.</p>
          </> : <p className="text-sm text-slate-600">No second group is available to compare.</p>}
        </div>
      </details>
    </div>}
  </div>;
}
