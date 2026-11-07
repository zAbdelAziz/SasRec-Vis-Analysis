import { useState } from 'react';
import type { Data } from 'plotly.js';
import PlotFrame from '../components/PlotFrame';
import H1AttentionDiagnostics from './H1AttentionDiagnostics';
import MovieList, { type Movie } from '../components/MovieList';
import type { VizProps } from './types';

type Matched = {
  user_id: number; distance: number; overlapping: number; disjoint: number;
  weight: number; gap: number;
};
type GenreStat = {
  query: string; key: string;
  nonself: { mean: number | null; count: number; mass: number; users: number };
};
type AttentionUser = {
  user_id: number; attention: (number | null)[][]; history_movies: Movie[];
  row_padding_mass: number[]; retained_row_mass: number[];
};

export default function H1InternalView({ result }: VizProps) {
  const diagnostics = result.views.diagnostics as {
    distance?: { matched?: Matched[]; summary?: { matched_users: number; gap: number | null; positive_users: number } };
    genre_statistics?: GenreStat[];
  } | undefined;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [queryIndex, setQueryIndex] = useState<number | null>(null);
  const [fullMatrix, setFullMatrix] = useState(false);
  const [queryGenre, setQueryGenre] = useState('');
  const [keyGenre, setKeyGenre] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const users = (result.views.users as AttentionUser[]) ?? [];
  const matched = diagnostics?.distance?.matched ?? [];
  const genreStats = diagnostics?.genre_statistics ?? [];
  if (!diagnostics?.distance || !genreStats.length) {
    return <div className="surface p-5 text-sm text-slate-700">The saved Phase II analysis does not contain the position-matched attention audit. Rerun H1 Phase II to generate it.</div>;
  }
  const byUser = new Map<number, Matched[]>();
  matched.forEach((row) => byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]));
  const comparison = [...byUser.entries()].map(([user_id, data]) => {
    const weight = data.reduce((sum, row) => sum + row.weight, 0);
    return { user_id, n: data.length, pairs: weight,
      shared: data.reduce((sum, row) => sum + row.overlapping * row.weight, 0) / weight,
      disjoint: data.reduce((sum, row) => sum + row.disjoint * row.weight, 0) / weight };
  }).sort((a, b) => (a.shared - a.disjoint) - (b.shared - b.disjoint));
  const selected = users.find((user) => user.user_id === selectedId) ??
    users.find((user) => user.user_id === comparison[0]?.user_id) ?? users[0];
  const history = selected?.history_movies ?? [];
  const focus = queryIndex == null || queryIndex >= history.length ? history.length - 1 : queryIndex;
  const genreMass = new Map<string, number>();
  for (const row of genreStats) {
    genreMass.set(row.query, (genreMass.get(row.query) ?? 0) + (row.nonself?.mass ?? 0));
  }
  const allGenres = [...genreMass.keys()].sort((a, b) => a.localeCompare(b));
  const defaultGenres = [...genreMass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name).sort();
  const genres = fullMatrix ? allGenres : defaultGenres;
  const cell = new Map(genreStats.map((row) => [`${row.query}::${row.key}`, row]));
  const heatmap = genres.map((query) => genres.map((key) => cell.get(`${query}::${key}`)?.nonself?.mean ?? null));
  const support = genres.map((query) => genres.map((key) => {
    const s = cell.get(`${query}::${key}`)?.nonself;
    return s?.mean == null ? `${query} → ${key}<br>No non-self observations` :
      `${query} → ${key}<br>${s.users} users · ${s.count} movie pairs<br>Fractional contribution ${s.mass.toFixed(1)}`;
  }));
  const focusedCell = cell.get(`${queryGenre}::${keyGenre}`)?.nonself;
  const labels = comparison.map((row) => `User ${row.user_id}`);
  const comparePlots: Data[] = comparison.length ? [
    { type: 'scatter', mode: 'lines', showlegend: false, hoverinfo: 'skip',
      x: comparison.flatMap((r) => [r.disjoint, r.shared, null]),
      y: labels.flatMap((label) => [label, label, null]), line: { color: '#cbd5e1', width: 2 } },
    { type: 'scatter', mode: 'markers', name: 'No shared genres',
      x: comparison.map((r) => r.disjoint), y: labels,
      customdata: comparison.map((r) => r.user_id),
      text: comparison.map((r) => `${r.n} distance-matched strata · weight ${r.pairs}`),
      marker: { color: '#64748b', size: comparison.map((r) => r.user_id === selected?.user_id ? 11 : 8) },
      hovertemplate: 'User %{customdata}<br>No shared genres: %{x:.5f}<br>%{text}<extra></extra>' },
    { type: 'scatter', mode: 'markers', name: 'At least one shared genre',
      x: comparison.map((r) => r.shared), y: labels,
      customdata: comparison.map((r) => r.user_id),
      text: comparison.map((r) => `${r.n} distance-matched strata · weight ${r.pairs}`),
      marker: { color: '#0f766e', size: comparison.map((r) => r.user_id === selected?.user_id ? 11 : 8), symbol: 'diamond' },
      hovertemplate: 'User %{customdata}<br>Shared genres: %{x:.5f}<br>%{text}<extra></extra>' },
  ] as Data[] : [];
  const attentionToPast = history.slice(0, focus).map((movie, index) => ({
    movie, attention: selected?.attention[focus]?.[index] ?? null, position: index + 1,
  }));
  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <h2 className="text-base font-bold text-slate-900">Does SASRec attend differently to movies that share genres?</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">Left: compare attention to related and unrelated movie pairs <strong>within the same user and sequence distance</strong>. Right: explore which genres attend to which other genres (excluding self-pairs).</p>
      <p className="mt-2 text-xs text-slate-500">{comparison.length} of {users.length} users have valid distance-matched comparisons · {diagnostics.distance.summary?.positive_users ?? 0} show greater attention for shared genres. Attention is descriptive, not a causal explanation.</p>
    </div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Shared vs different genres by user" height={Math.max(340, comparison.length * 33 + 120)}
        note="Each row joins two distance-matched means. A diamond to the right of the gray dot means more attention to shared-genre pairs. Select a user."
        data={comparePlots}
        layout={{ xaxis: { title: { text: 'Mean attention probability' } },
          yaxis: { categoryorder: 'array', categoryarray: labels, autorange: 'reversed' },
          legend: { orientation: 'h', y: 1.18 }, margin: { l: 85, b: 70, t: 55 } }}
        onPoint={(point) => { if (point.customdata != null) { setSelectedId(Number(point.customdata)); setQueryIndex(null); } }} />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={fullMatrix} onChange={(e) => setFullMatrix(e.target.checked)} />Show all 18 genres</label>
        </div>
        <PlotFrame title="Which genres attend to which other genres?" height={440}
          note="Rows are the attending (query) genre, columns are the attended-to (key) genre. Gray = no observed non-self pairs. Select a cell to see its support."
          data={[{ type: 'heatmap', x: genres, y: genres, z: heatmap, text: support,
            colorscale: 'Viridis', zmin: 0, hoverongaps: false,
            hovertemplate: '%{text}<br>Mean attention: %{z:.5f}<extra></extra>' } as Data]}
          layout={{ plot_bgcolor: '#e2e8f0', xaxis: { title: { text: 'Attended-to genre' } },
            yaxis: { title: { text: 'Attending genre' }, autorange: 'reversed' },
            margin: { l: fullMatrix ? 100 : 90, b: fullMatrix ? 120 : 85, t: 20 } }}
          onPoint={(point) => { setQueryGenre(String(point.y ?? '')); setKeyGenre(String(point.x ?? '')); }} />
        {queryGenre && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700" aria-live="polite">
          <strong>{queryGenre} → {keyGenre}:</strong> {focusedCell?.mean == null ? 'No observations.' :
            `mean ${focusedCell.mean.toFixed(5)} · ${focusedCell.users} contributing users · ${focusedCell.count} observed pairs.`}
        </p>}
      </div>
    </div>
    {selected && <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-sm font-bold text-slate-900">Inspect an actual historical movie sequence</h3>
          <p className="mt-1 text-xs text-slate-500">Which earlier movies receive attention from the selected query position?</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-semibold">User <select className="field mt-1" value={selected.user_id} onChange={(e) => { setSelectedId(Number(e.target.value)); setQueryIndex(null); }}>
            {users.map((u) => <option key={u.user_id} value={u.user_id}>User {u.user_id}</option>)}</select></label>
          <label className="text-xs font-semibold">Attending movie <select className="field mt-1 max-w-56" value={focus} onChange={(e) => setQueryIndex(Number(e.target.value))}>
            {history.map((movie, index) => <option key={index} value={index}>{index+1}. {movie.title}</option>)}</select></label>
        </div>
      </div>
      {attentionToPast.length ? <PlotFrame title={`Earlier movies attended to by movie ${focus+1}`} height={Math.min(620, Math.max(260, attentionToPast.length * 25 + 120))}
        note="Original attention weights, not renormalized after hiding self-attention, padding, or earlier context outside this selected window."
        data={[{ type: 'bar', orientation: 'h',
          x: attentionToPast.map((row) => row.attention),
          y: attentionToPast.map((row) => `#${row.position}`),
          text: attentionToPast.map((row) => `${row.movie.title} · ${row.movie.genres.join(', ')}`),
          marker: { color: '#0f766e' },
          hovertemplate: '%{y}: %{text}<br>Attention: %{x:.5f}<extra></extra>' } as Data]}
        layout={{ yaxis: { autorange: 'reversed', title: { text: 'Earlier history position' } },
          xaxis: { title: { text: 'Attention probability (raw)' }, rangemode: 'tozero' },
          margin: { l: 80, b: 70, t: 20 } }} /> :
        <p className="rounded bg-slate-50 p-3 text-sm">Select a later movie to inspect attention to earlier positions.</p>}
      <details><summary className="cursor-pointer text-sm font-medium text-slate-700">See chronological movie titles and genres</summary>
        <MovieList title="Historical movies in model-visible window" movies={history} /></details>
    </section>}
    <details className="rounded-xl border border-slate-200 bg-white p-4" onToggle={(event) => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Advanced attention audit: distance effects, matrix support, and movie-pair diagnostics</summary>
      {advanced && <div className="mt-4"><H1AttentionDiagnostics result={result} rawScale={0.1} /></div>}
    </details>
  </div>;
}
