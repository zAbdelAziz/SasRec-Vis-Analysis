import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import type { GroupEstimate } from './DemographicDotChart';
import { asPercentagePoints, GROUP_COLORS, ppLabel } from '../../lib/visualizationData';

type Props = { genres: string[]; groupA: GroupEstimate[]; groupB: GroupEstimate[]; labelA: string; labelB: string;
  showAll: boolean; activeGenre: string; onSelect: (genre: string) => void };

export default function GroupComparisonChart({ genres, groupA, groupB, labelA, labelB, showAll, activeGenre, onSelect }: Props) {
  const a = new Map(groupA.map((s) => [s.genre, s]));
  const b = new Map(groupB.map((s) => [s.genre, s]));
  const sorted = [...genres].sort((g, h) => {
    const gap = (name: string) => {
      const av = a.get(name)?.mean; const bv = b.get(name)?.mean;
      return av != null && bv != null ? Math.abs(av - bv) : Math.abs(av ?? bv ?? 0);
    };
    return gap(h) - gap(g) || g.localeCompare(h);
  });
  const shown = showAll ? sorted : sorted.slice(0, 8);
  const scales = [...groupA, ...groupB].flatMap((s) => [s.mean, s.ci_low, s.ci_high])
    .filter((value): value is number => value !== null).map((value) => Math.abs(asPercentagePoints(value)));
  const spread = Math.max(5, ...scales);
  const traces: Data[] = [groupA, groupB].map((group, index) => {
    const byGenre = new Map(group.map((s) => [s.genre, s]));
    const values = shown.map((genre) => byGenre.get(genre));
    return { type: 'scatter', mode: 'markers', name: index === 0 ? `A: ${labelA}` : `B: ${labelB}`,
      x: values.map((s) => s?.mean == null || !s.n ? null : asPercentagePoints(s.mean)),
      y: shown.map((_, j) => j + (index ? 0.16 : -0.16)), customdata: shown,
      text: values.map((s, j) => `${shown[j]}<br>${index ? 'B' : 'A'} · ${index ? labelB : labelA}<br>Users: ${s?.n ?? 0}<br>Mean change: ${ppLabel(s?.mean)}<br>95% bootstrap interval: ${s?.ci_low == null || s?.ci_high == null ? 'not available' : `${ppLabel(s.ci_low)} to ${ppLabel(s.ci_high)}`}`),
      marker: { color: GROUP_COLORS[index], symbol: index ? 'diamond' : 'circle',
        size: shown.map((genre) => genre === activeGenre ? 15 : 10) },
      error_x: { type: 'data', symmetric: false,
        array: values.map((s) => s?.mean == null || s.ci_high == null ? 0 : Math.max(0, asPercentagePoints(s.ci_high - s.mean))),
        arrayminus: values.map((s) => s?.mean == null || s.ci_low == null ? 0 : Math.max(0, asPercentagePoints(s.mean - s.ci_low))) },
      hovertemplate: '%{text}<extra></extra>',
    } as Data;
  });
  return <PlotFrame title="Where do these two groups differ by genre?"
    note="Both groups share a scale. Dots are average change in genre share, with 95% bootstrap intervals. Differences between dots are descriptive, not a significance test of group differences. Select a genre to see it in the overview."
    data={traces} height={Math.max(400, shown.length * 42 + 130)}
    layout={{ margin: { l: 125, r: 25, t: 60, b: 65 },
      xaxis: { title: { text: 'Mean change (percentage points)' }, range: [-spread * 1.22, spread * 1.22], zeroline: true, zerolinecolor: '#475569', ticksuffix: ' pp' },
      yaxis: { tickmode: 'array', tickvals: shown.map((_, j) => j), ticktext: shown, range: [shown.length - 0.6, -0.6] },
      legend: { orientation: 'h', y: 1.12 } }}
    onPoint={(point) => { if (point.customdata !== undefined) onSelect(String(point.customdata)); }} />;
}
