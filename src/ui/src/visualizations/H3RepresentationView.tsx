import { useState } from 'react';
import type { Data } from 'plotly.js';
import PlotFrame from '../components/PlotFrame';
import type { VizProps } from './types';

type Group = {
  age_code: string; age_label: string; gender: string; genre: string;
  n: number; group_users?: number; mean: number | null;
  ci_low: number | null; ci_high: number | null; sparse: boolean;
};
type InternalUser = {
  user_id: number; age_code: string; gender: string;
  relative_alignment: Record<string, number>;
  attention_excess: Record<string, number>;
  position_excess: Record<string, number> | null;
  history_profile: Record<string, number>;
  recommendation_profile: Record<string, number>;
  attention_self_mass: number; attention_padding_mass: number;
  attention_nonself_mass: number;
  attention_key_count: number;
  position_reference_available: boolean;
};
type MovieAttention = { item_id: number; title: string; genres: string[]; distance: number; attention_weight: number };
type Example = { user_id: number; attention_movie_preview?: MovieAttention[] };
type AttentionViews = {
  layer: number; head: number; head_count: number;
  groups: Group[]; position_groups: Group[]; conditional_groups: Group[];
  position_available_users: number; position_unavailable_users: number;
  mean_self_mass: number | null; mean_padding_mass: number | null;
};
const person = (gender: string) => gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : gender;
const groupKey = (row: { age_code: string; gender: string }) => `${row.age_code}/${row.gender}`;
const signed = (value: number, decimals = 3) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}`;
const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const pp = (value: number) => `${signed(value * 100, 1)} pp`;

export default function H3RepresentationView({ result }: VizProps) {
  const groups = (result.views.groups ?? []) as Group[];
  const users = (result.views.users ?? []) as InternalUser[];
  const genres = (result.views.genres ?? []) as string[];
  const ages = (result.views.ages ?? {}) as Record<string, string>;
  const references = (result.views.genre_reference_support ?? {}) as Record<string, { movies: number }>;
  const attention = result.views.attention as AttentionViews | undefined;
  const examples = (result.examples ?? []) as Example[];
  const [chosenGenre, chooseGenre] = useState('Drama');
  const [groupChoice, chooseGroup] = useState('');
  const [userChoice, chooseUser] = useState<number | null>(null);
  const [attentionReference, chooseReference] = useState<'uniform' | 'position'>('uniform');
  if (result.views.analysis !== 'demographic_internal_attention_v2' || !attention?.groups || !result.views.attention_available) {
    return <div className="surface p-5 text-sm text-amber-800">The saved result uses an older H3 methodology. Run H3 Phase II with the updated analysis to obtain actual learned-state and final-query attention measurements. Previous accuracy or representation-only results are not shown as attention evidence.</div>;
  }

  const genre = genres.includes(chosenGenre) ? chosenGenre : genres[0];
  const relevant = groups.filter((row) => row.genre === genre);
  const available = relevant.filter((row) => row.n > 0 && row.mean !== null);
  const preferred = [...available].sort((a, b) => b.n - a.n || groupKey(a).localeCompare(groupKey(b)))[0];
  const selectedGroup = available.some((row) => groupKey(row) === groupChoice) ? groupChoice : preferred ? groupKey(preferred) : '';
  const active = available.find((row) => groupKey(row) === selectedGroup);
  const groupUsers = users.filter((row) => groupKey(row) === selectedGroup);
  const individual = groupUsers.find((row) => row.user_id === userChoice) ?? groupUsers[0];
  const savedExample = examples.find((row) => row.user_id === individual?.user_id);
  const allLimits = groups.flatMap((row) => [row.mean, row.ci_low, row.ci_high])
    .filter((value): value is number => value != null && Number.isFinite(value));
  const span = Math.max(0.025, ...allLimits.map(Math.abs)) * 1.15;
  const baselineRows = (attentionReference === 'position' ? attention.position_groups : attention.groups) ?? [];
  const rightRows = baselineRows.filter((row) => groupKey(row) === selectedGroup && row.n > 0 && row.mean !== null)
    .sort((a, b) => Math.abs(b.mean ?? 0) - Math.abs(a.mean ?? 0));
  const groupAttention = baselineRows.find((row) => groupKey(row) === selectedGroup && row.genre === genre);
  const alignmentRange = groups.find((row) => groupKey(row) === selectedGroup && row.genre === genre);
  const groupPhaseOne = groupUsers.length
    ? groupUsers.reduce((sum, row) => sum + ((row.recommendation_profile[genre] ?? 0) - (row.history_profile[genre] ?? 0)), 0) / groupUsers.length
    : null;
  const cohort = (result.views.cohort_user_ids ?? []) as number[];
  const cohortOK = cohort.length === users.length && new Set(cohort).size === users.length &&
    cohort.every((id) => users.some((row) => row.user_id === id));

  return <div className="space-y-4">
    <header className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <h2 className="text-base font-bold text-slate-900">What genre information appears in SASRec’s learned representations and attention?</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">Left: alignment of learned user states with post-hoc genre vectors. Right: how much attention the model actually assigns to earlier movies of each genre, compared with their presence in history. Both investigate <strong>internal model signals</strong>, not whether recommendations are correct.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 font-semibold text-slate-800">Genre
          <select className="field max-w-52 py-1.5 text-xs" value={genre} onChange={(event) => chooseGenre(event.target.value)}>
            {genres.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <span>{users.length} users · {references[genre]?.movies ?? '-'} movies in the {genre} reference</span>
        <span>Attention: layer {attention.layer + 1}, {attention.head === -1 ? `all ${attention.head_count} heads averaged` : `head ${attention.head + 1}`}</span>
      </div>
    </header>

    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)]">
      <section className="min-w-0 space-y-3" aria-label="Learned genre alignment by age and gender">
        {(['M', 'F'] as const).map((gender) => {
          const ageItems = Object.entries(ages).map(([code, label]) => ({
            code, label, row: relevant.find((value) => value.age_code === code && value.gender === gender),
          }));
          const traces = ageItems.filter((item) => item.row?.n && item.row.mean != null).map((item) => {
            const row = item.row!;
            const focused = groupKey(row) === selectedGroup;
            return {
              type: 'scatter', mode: 'markers', showlegend: false,
              x: [row.mean], y: [item.label], customdata: [groupKey(row)],
              text: [`${row.n} users${row.sparse ? ' · small group' : ''}<br>95% CI: ${row.ci_low == null || row.ci_high == null ? 'unavailable' : `${row.ci_low.toFixed(4)} to ${row.ci_high.toFixed(4)}`}`],
              marker: { color: focused ? '#ea580c' : '#0f766e', symbol: 'diamond', size: focused ? 12 : 9 },
              error_x: row.ci_low != null && row.ci_high != null ? {
                type: 'data', symmetric: false, visible: true,
                array: [Math.max(0, row.ci_high - row.mean!)],
                arrayminus: [Math.max(0, row.mean! - row.ci_low)],
                color: focused ? '#ea580c' : '#64748b', thickness: 1.5,
              } : undefined,
              hovertemplate: `${item.label} · ${person(gender)}<br>Relative cosine: %{x:+.4f}<br>%{text}<extra></extra>`,
            } as Data;
          });
          return <PlotFrame key={gender} title={person(gender)} height={258}
            note="Choose an age group; the two plots use the same scale. Zero is this user's mean genre alignment."
            data={traces}
            layout={{ xaxis: { title: { text: 'Relative cosine alignment' }, range: [-span, span], zeroline: true, zerolinecolor: '#475569' },
              yaxis: { categoryorder: 'array', categoryarray: ageItems.map((item) => item.label), autorange: 'reversed' },
              margin: { l: 78, b: 55, t: 12 } }}
            onPoint={(point) => { if (point.customdata != null) { chooseGroup(String(point.customdata)); chooseUser(null); } }} />;
        })}
      </section>

      <section className="min-w-0 space-y-3" aria-label="Selected group's actual historical genre attention">
        {active ? <>
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs">
            <p className="font-semibold text-slate-900">{active.age_label} · {person(active.gender)} · {active.n} users</p>
            <p className="mt-1 text-slate-700">For {genre}: relative alignment <strong>{signed(active.mean!)}</strong> · attention above history exposure <strong>{groupAttention?.mean == null ? 'unavailable' : pp(groupAttention.mean)}</strong></p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">Attention reference</span>
            <select className="field max-w-full py-1 text-xs" value={attentionReference} onChange={(event) => chooseReference(event.target.value as 'uniform' | 'position')}>
              <option value="uniform">Same attention to each earlier movie</option>
              <option value="position">Other users’ attention at the same history distance</option>
            </select>
          </div>
          <PlotFrame title="Which historical genres receive more attention than expected?" height={510}
            note={attentionReference === 'uniform'
              ? 'Difference in raw attention probability mass (percentage points). Zero means exactly as much attention as the genre’s share of preceding movies predicts; self-attention and padding remain separate.'
              : 'Position-aware sensitivity check. The reference is built from other sampled users, excluding the selected user; missing comparisons are not zero.'}
            data={rightRows.length ? [{ type: 'bar', orientation: 'h',
              y: rightRows.map((row) => row.genre),
              x: rightRows.map((row) => (row.mean ?? 0) * 100),
              marker: { color: rightRows.map((row) => row.genre === genre ? '#ea580c' : (row.mean ?? 0) >= 0 ? '#0f766e' : '#b45309') },
              customdata: rightRows.map((row) => `${row.n} users · ${row.sparse ? 'sparse group · ' : ''}${row.ci_low == null ? 'CI unavailable' : `95% CI ${pp(row.ci_low)} to ${pp(row.ci_high!)}`}`),
              error_x: { type: 'data', symmetric: false, visible: true,
                array: rightRows.map((row) => row.ci_high == null || row.mean == null ? 0 : 100 * Math.max(0, row.ci_high - row.mean)),
                arrayminus: rightRows.map((row) => row.ci_low == null || row.mean == null ? 0 : 100 * Math.max(0, row.mean - row.ci_low)),
                color: '#64748b', thickness: 1.2 },
              hovertemplate: '%{y}<br>Attention excess: %{x:+.2f} pp<br>%{customdata}<extra></extra>' } as Data] : []}
            layout={{ xaxis: { title: { text: 'Attention mass above / below reference (pp)' }, zeroline: true, zerolinecolor: '#475569' },
              yaxis: { autorange: 'reversed' }, margin: { l: 102, b: 68, t: 15 } }} />
          <p className="text-xs text-slate-500">{attentionReference === 'position'
            ? `Position reference available for ${attention.position_available_users}/${users.length} sampled users; group estimates use only supported users.`
            : `Mean attention to self: ${attention.mean_self_mass == null ? '-' : pct(attention.mean_self_mass)} · to padding: ${attention.mean_padding_mass == null ? '-' : pct(attention.mean_padding_mass)}. Raw model probabilities are not renormalized.`}</p>
        </> : <p className="surface p-5 text-sm">No demographic observations are available for this genre.</p>}
      </section>
    </div>

    {active && <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Connect internal evidence with Phase I genre changes</summary>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">These observations are computed for the <strong>same users, histories, and recommendations within this Phase II run</strong> (which re-executes Phase I internally with these settings; a separately saved Phase I page may use different settings). They have different units and do not establish that alignment or attention caused a recommendation difference.</p>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Phase I: {genre} share change</p><strong className="text-base">{groupPhaseOne == null ? '-' : pp(groupPhaseOne)}</strong></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Phase II: relative embedding alignment</p><strong className="text-base">{alignmentRange?.mean == null ? '-' : signed(alignmentRange.mean)}</strong></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Phase II: genre attention excess</p><strong className="text-base">{groupAttention?.mean == null ? '-' : pp(groupAttention.mean)}</strong></div>
      </div>
      <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-2">
        <PlotFrame title="Representation vs recommendation change" height={300}
          note="Each dot is one user in the selected demographic group."
          data={[{ type: 'scatter', mode: 'markers',
            x: groupUsers.map((row) => 100 * ((row.recommendation_profile[genre] ?? 0) - (row.history_profile[genre] ?? 0))),
            y: groupUsers.map((row) => row.relative_alignment[genre] ?? 0),
            customdata: groupUsers.map((row) => row.user_id),
            marker: { color: groupUsers.map((row) => row.user_id === individual?.user_id ? '#ea580c' : '#0f766e'), size: 9 },
            hovertemplate: 'User %{customdata}<br>Share change %{x:+.1f} pp<br>Relative cosine %{y:+.4f}<extra></extra>' } as Data]}
          layout={{ xaxis: { title: { text: 'Recommendation share − history (pp)' }, zeroline: true },
            yaxis: { title: { text: 'Relative cosine' }, zeroline: true }, margin: { l: 70, b: 65 } }}
          onPoint={(point) => { if (point.customdata != null) chooseUser(Number(point.customdata)); }} />
        <PlotFrame title="Attention vs recommendation change" height={300}
          note="Attention is compared with historical genre exposure, not with another recommendation list."
          data={[{ type: 'scatter', mode: 'markers',
            x: groupUsers.map((row) => 100 * ((row.recommendation_profile[genre] ?? 0) - (row.history_profile[genre] ?? 0))),
            y: groupUsers.map((row) => (row.attention_excess[genre] ?? 0) * 100),
            customdata: groupUsers.map((row) => row.user_id),
            marker: { color: groupUsers.map((row) => row.user_id === individual?.user_id ? '#ea580c' : '#0f766e'), size: 9 },
            hovertemplate: 'User %{customdata}<br>Share change %{x:+.1f} pp<br>Attention excess %{y:+.2f} pp<extra></extra>' } as Data]}
          layout={{ xaxis: { title: { text: 'Recommendation share − history (pp)' }, zeroline: true },
            yaxis: { title: { text: 'Attention excess (pp)' }, zeroline: true }, margin: { l: 70, b: 65 } }}
          onPoint={(point) => { if (point.customdata != null) chooseUser(Number(point.customdata)); }} />
      </div>
    </details>}

    {individual && <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Inspect one contributing user and actual historical attention</summary>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="font-semibold">User
          <select className="field ml-2" value={individual.user_id} onChange={(event) => chooseUser(Number(event.target.value))}>
            {groupUsers.map((row) => <option key={row.user_id} value={row.user_id}>User {row.user_id}</option>)}
          </select>
        </label>
        <span>{genre} history {pct(individual.history_profile[genre] ?? 0)} → recommendations {pct(individual.recommendation_profile[genre] ?? 0)}</span>
        <span>Internal cosine {signed(individual.relative_alignment[genre] ?? 0)}</span>
        <span>Attention excess {pp(individual.attention_excess[genre] ?? 0)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">The final query attends across {individual.attention_key_count} earlier real movie positions. Its unmodified probability mass is {pct(individual.attention_nonself_mass)} to earlier movies, {pct(individual.attention_self_mass)} to itself, and {pct(individual.attention_padding_mass)} to padding.</p>
      {savedExample?.attention_movie_preview?.length ? <div className="mt-3">
        <PlotFrame title="Which earlier movies received attention from the final historical position?" height={370}
          note="Last 24 preceding movies of this saved case, not normalized to sum to 100%. Hover for titles and genres."
          data={[{ type: 'bar', orientation: 'h',
            x: savedExample.attention_movie_preview.map((row) => row.attention_weight),
            y: savedExample.attention_movie_preview.map((row) => `−${row.distance}`),
            customdata: savedExample.attention_movie_preview.map((row) => `${row.title} · ${row.genres.join(', ')}`),
            marker: { color: '#0f766e' }, hovertemplate: 'Position %{y}<br>%{customdata}<br>Raw attention %{x:.5f}<extra></extra>' } as Data]}
          layout={{ yaxis: { autorange: 'reversed' }, xaxis: { title: { text: 'Raw attention probability' }, rangemode: 'tozero' },
            margin: { l: 58, b: 52, t: 14 } }} />
      </div> : <p className="mt-2 text-xs text-slate-500">Movie-level details were saved for a limited set of users. This user’s aggregate attention values are still real measured data.</p>}
    </details>}
    <p className="text-xs text-slate-500">{cohortOK ? 'User IDs verified against this run’s H3 Phase I cohort.' : 'Cohort metadata is incomplete: verify this analysis before interpreting cross-phase comparisons.'} These are descriptive internal diagnostics, not causal explanations or demographic features supplied to SASRec.</p>
  </div>;
}
