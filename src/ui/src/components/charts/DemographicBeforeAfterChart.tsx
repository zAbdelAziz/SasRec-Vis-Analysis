import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import { CHANGE_COLORS, ppLabel } from '../../lib/visualizationData';

export type DemographicEstimate = {
  age_code: string;
  age_label: string;
  gender: string;
  genre: string;
  n: number;
  history_mean: number | null;
  recommendation_mean: number | null;
  mean: number | null;
  ci_low: number | null;
  ci_high: number | null;
  sparse: boolean;
};
export const demographicKey = (value: { age_code: string; gender: string }) => `${value.age_code}/${value.gender}`;
export const genderLabel = (value: string) => value === 'F' ? 'Female' : value === 'M' ? 'Male' : value;

type Props = {
  ages: Record<string, string>;
  gender: string;
  estimates: DemographicEstimate[];
  genre: string;
  xMax: number;
  selectedGroup: string;
  onSelect: (group: string) => void;
};

/** One compact gender facet. Both facets receive the same horizontal range. */
export default function DemographicBeforeAfterChart({ ages, gender, estimates, genre, xMax, selectedGroup, onSelect }: Props) {
  const ordered = Object.entries(ages).map(([code, label]) => ({
    key: `${code}/${gender}`,
    label,
    estimate: estimates.find((record) => record.age_code === code && record.gender === gender),
  }));
  const positions = ordered.map((_, index) => ordered.length - index - 1);
  const traces: Data[] = [];

  ordered.forEach(({ key, label, estimate }, index) => {
    if (!estimate || !estimate.n || estimate.history_mean == null || estimate.recommendation_mean == null || estimate.mean == null) return;
    const color = estimate.mean >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease;
    const selected = key === selectedGroup;
    const tooltip = `${label} · ${genderLabel(gender)}<br>${estimate.n} users${estimate.n < 5 ? ' (small group)' : ''}<br>` +
      `${genre} in histories: ${(estimate.history_mean * 100).toFixed(1)}%<br>` +
      `${genre} in recommendations: ${(estimate.recommendation_mean * 100).toFixed(1)}%<br>` +
      `Change: ${ppLabel(estimate.mean)}<br>` +
      `95% bootstrap interval for change: ${estimate.ci_low == null || estimate.ci_high == null ? 'unavailable' : `${ppLabel(estimate.ci_low)} to ${ppLabel(estimate.ci_high)}`}`;
    traces.push({ type: 'scatter', mode: 'lines+markers', showlegend: false,
      x: [estimate.history_mean * 100, estimate.recommendation_mean * 100],
      y: [positions[index], positions[index]],
      customdata: [key, key], text: [tooltip, tooltip], hovertemplate: '%{text}<extra></extra>',
      line: { color, width: selected ? 3.0 : 2.0 },
      marker: { color: [CHANGE_COLORS.baseline, color], symbol: ['circle', 'diamond'],
        size: selected ? [10, 12] : [7, 9], line: { color: '#fff', width: 1 } } });
  });
  const highlighted = ordered.findIndex((row) => row.key === selectedGroup);
  return <div className="min-w-0">
    <PlotFrame title={genderLabel(gender)}
      data={traces} height={Math.max(244, ordered.length * 24 + 73)}
      layout={{ margin: { l: 82, r: 14, t: 10, b: 43 }, showlegend: false,
        xaxis: { title: { text: `${genre} share (%)` }, range: [0, xMax], ticksuffix: '%', zeroline: true },
        yaxis: { tickmode: 'array', tickvals: positions, ticktext: ordered.map((row) => row.label),
          range: [-0.55, ordered.length - 0.45], fixedrange: true, showgrid: false, zeroline: false },
        shapes: highlighted >= 0 ? [{ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1,
          y0: positions[highlighted] - 0.40, y1: positions[highlighted] + 0.40,
          fillcolor: 'rgba(15,118,110,0.06)', line: { color: 'rgba(15,118,110,0.12)' }, layer: 'below' }] : [] }}
      onPoint={(point) => { if (point.customdata !== undefined) onSelect(String(point.customdata)); }} />
  </div>;
}
