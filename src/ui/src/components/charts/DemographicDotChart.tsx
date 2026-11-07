import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import { asPercentagePoints, GROUP_COLORS, ppLabel } from '../../lib/visualizationData';

export type GroupEstimate = { age_code: string; age_label: string; gender: string; genre: string; n: number;
  history_mean: number | null; recommendation_mean: number | null; mean: number | null;
  ci_low: number | null; ci_high: number | null; sparse: boolean };
type Props = { ages: Array<[string,string]>; genders: string[]; estimates: GroupEstimate[];
  genre: string; selectedGroup: string; onSelect: (group: string) => void };

export default function DemographicDotChart({ ages, genders, estimates, genre, selectedGroup, onSelect }: Props) {
  const traces: Data[] = genders.map((gender, index) => {
    const valid = estimates.filter((s) => s.gender === gender && s.mean !== null && s.n > 0);
    return { type: 'scatter', mode: 'markers', name: `Gender ${gender}`,
      x: valid.map((s) => asPercentagePoints(s.mean!)),
      y: valid.map((s) => ages.findIndex(([code]) => code === s.age_code) + (index - (genders.length - 1) / 2) * 0.27),
      customdata: valid.map((s) => `${s.age_code}/${s.gender}`),
      text: valid.map((s) => `${s.age_label} · gender ${s.gender}<br>Users: ${s.n}${s.sparse ? ' (small group)' : ''}<br>Mean change: ${ppLabel(s.mean)}<br>History share: ${s.history_mean == null ? '-' : `${(s.history_mean * 100).toFixed(1)}%`}<br>Recommendation share: ${s.recommendation_mean == null ? '-' : `${(s.recommendation_mean * 100).toFixed(1)}%`}<br>95% bootstrap interval: ${s.ci_low == null || s.ci_high == null ? 'not available' : `${ppLabel(s.ci_low)} to ${ppLabel(s.ci_high)}`}`),
      marker: { color: gender === 'M' ? GROUP_COLORS[1] : GROUP_COLORS[0], symbol: index ? 'diamond' : 'circle',
        size: valid.map((s) => `${s.age_code}/${s.gender}` === selectedGroup ? 15 : 11), line: { color: '#ffffff', width: 1 } },
      error_x: { type: 'data', symmetric: false,
        array: valid.map((s) => s.ci_high == null ? 0 : Math.max(0, asPercentagePoints(s.ci_high - s.mean!))),
        arrayminus: valid.map((s) => s.ci_low == null ? 0 : Math.max(0, asPercentagePoints(s.mean! - s.ci_low))) },
      hovertemplate: '%{text}<extra></extra>',
    } as Data;
  });
  const spread = Math.max(5, ...estimates.flatMap((s) => [s.mean, s.ci_low, s.ci_high]
    .filter((value): value is number => value !== null).map((value) => Math.abs(asPercentagePoints(value)))));
  return <PlotFrame title={`${genre}: change in recommendation share by age and gender`}
    note="Each dot is a group average; the horizontal whisker is its 95% bootstrap interval when available. Left of zero = less representation, right = more. Click a dot to choose comparison group A."
    data={traces} height={Math.max(390, ages.length * 55 + 120)}
    layout={{ margin: { l: 105, r: 25, t: 40, b: 70 },
      xaxis: { title: { text: 'Mean change in share (percentage points)' }, range: [-spread * 1.23, spread * 1.23], zeroline: true, zerolinecolor: '#475569', ticksuffix: ' pp' },
      yaxis: { tickmode: 'array', tickvals: ages.map((_, index) => index), ticktext: ages.map(([, name]) => name), range: [ages.length - 0.55, -0.55], fixedrange: true },
      legend: { orientation: 'h', y: 1.12 } }}
    onPoint={(point) => { if (point.customdata !== undefined) onSelect(String(point.customdata)); }} />;
}
