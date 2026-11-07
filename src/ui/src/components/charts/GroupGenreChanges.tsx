import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import type { DemographicEstimate } from './DemographicBeforeAfterChart';
import { CHANGE_COLORS, ppLabel } from '../../lib/visualizationData';

type Props = {
  groupLabel: string;
  estimates: DemographicEstimate[];
  selectedGenre: string;
  onGenre: (genre: string) => void;
};

export default function GroupGenreChanges({ groupLabel, estimates, selectedGenre, onGenre }: Props) {
  const meaningful = estimates.filter((row) => row.n > 0 && row.mean != null);
  const ranked = [...meaningful].sort((a, b) => Math.abs(b.mean!) - Math.abs(a.mean!) || a.genre.localeCompare(b.genre));
  const shown = ranked.slice(0, 8);
  if (!shown.some((row) => row.genre === selectedGenre)) {
    const additional = ranked.find((row) => row.genre === selectedGenre);
    if (additional) shown.push(additional);
  }
  shown.sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
  const maxAbsolute = Math.max(3, ...shown.flatMap((row) => [row.mean, row.ci_low, row.ci_high]
    .filter((value): value is number => value !== null).map((value) => Math.abs(value * 100)))) * 1.25;
  const trace: Data = { type: 'bar', orientation: 'h', name: 'Mean share change',
    x: shown.map((row) => row.mean! * 100), y: shown.map((row) => row.genre),
    customdata: shown.map((row) => row.genre),
    hovertext: shown.map((row) => `Genre: ${row.genre}<br>${groupLabel} (${row.n} users)<br>History share: ${row.history_mean == null ? 'Unavailable' : `${(row.history_mean * 100).toFixed(1)}%`}<br>Recommendation share: ${row.recommendation_mean == null ? 'Unavailable' : `${(row.recommendation_mean * 100).toFixed(1)}%`}<br>Difference: ${ppLabel(row.mean)}<br>95% bootstrap interval: ${row.ci_low == null || row.ci_high == null ? 'Unavailable' : `${ppLabel(row.ci_low)} to ${ppLabel(row.ci_high)}`}`),
    hovertemplate: '%{hovertext}<extra></extra>',
    marker: { color: shown.map((row) => row.mean! >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease),
      line: { color: '#fff', width: 1 } },
    error_x: { type: 'data', symmetric: false,
      array: shown.map((row) => row.ci_high == null ? 0 : Math.max(0, (row.ci_high - row.mean!) * 100)),
      arrayminus: shown.map((row) => row.ci_low == null ? 0 : Math.max(0, (row.mean! - row.ci_low) * 100)),
      color: '#64748b', thickness: 1.2, width: 3 },
  };
  return <PlotFrame title="Genre changes in the selected group"
    note={`Eight largest changes for ${groupLabel}${shown.length > 8 ? ', plus selected genre' : ''}. Right = more, left = less; whiskers show 95% intervals. Select a bar to change the highlighted genre.`}
    data={shown.length ? [trace] : []} height={Math.max(355, shown.length * 34 + 100)}
    layout={{ margin: { l: 110, r: 35, t: 30, b: 65 },
      xaxis: { title: { text: 'Mean change (percentage points)' }, range: [-maxAbsolute, maxAbsolute], ticksuffix: ' pp', zeroline: true, zerolinecolor: '#475569' },
      yaxis: { categoryorder: 'array', categoryarray: shown.map((row) => row.genre), autorange: 'reversed' } }}
    onPoint={(point) => { if (point.customdata !== undefined) onGenre(String(point.customdata)); }} />;
}
