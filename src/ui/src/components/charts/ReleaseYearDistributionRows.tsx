import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import { CHANGE_COLORS, relativeYearLabel } from '../../lib/visualizationData';

/** Values are saved per-user shares, not inferred from the average-year arrows. */
export type YearDistributionRow = {
  user_id: number;
  history_mean_year: number;
  recommendation_mean_year: number;
  shift_years: number;
  history_decades: Record<string, number>;
  recommendation_decades: Record<string, number>;
  history_known: number;
  recommendation_known: number;
};

type Props = {
  records: YearDistributionRow[];
  selectedUser: number | null;
  onSelect: (userId: number) => void;
};

const colorHistory = '#64748b';
const colorRecommendation = '#0f766e';

/** Piecewise-constant decade ridges: avoids inventing within-decade release-year densities. */
export function decadeRidge(decades: number[], shares: Record<string, number>, center: number,
  direction: 1 | -1, maximumShare: number): { x: number[]; y: number[] } {
  if (!decades.length) return { x: [], y: [] };
  const x: number[] = [decades[0]];
  const y: number[] = [center];
  for (const decade of decades) {
    const share = Math.max(0, Number(shares[String(decade)]) || 0);
    const height = Math.min(0.36, (share / maximumShare) * 0.34);
    x.push(decade, decade + 10);
    y.push(center + direction * height, center + direction * height);
  }
  x.push(decades[decades.length - 1] + 10);
  y.push(center);
  return { x, y };
}

export default function ReleaseYearDistributionRows({ records, selectedUser, onSelect }: Props) {
  const decadeValues = records.flatMap((row) => [
    ...Object.keys(row.history_decades || {}), ...Object.keys(row.recommendation_decades || {}),
  ]).map(Number).filter(Number.isFinite);
  const firstDecade = decadeValues.length ? Math.min(...decadeValues) : 1900;
  const lastDecade = decadeValues.length ? Math.max(...decadeValues) : 2000;
  const decades = Array.from({ length: Math.floor((lastDecade - firstDecade) / 10) + 1 }, (_, i) => firstDecade + i * 10);
  // Fix the scale to 100% so filtering cannot silently rescale identical decade shares.
  const maximumShare = 1;
  const traces: Data[] = [];
  const hoverPoints: Record<'history' | 'recommendations', { x: number[]; y: number[]; text: string[]; ids: number[] }> = {
    history: { x: [], y: [], text: [], ids: [] },
    recommendations: { x: [], y: [], text: [], ids: [] },
  };

  const labelValues = records.map((_, index) => records.length - 1 - index);
  records.forEach((row, index) => {
    const center = labelValues[index];
    const selected = row.user_id === selectedUser;
    for (const [kind, direction, color, fill] of [
      ['history', -1, colorHistory, 'rgba(100,116,139,0.25)'],
      ['recommendations', 1, colorRecommendation, 'rgba(15,118,110,0.22)'],
    ] as const) {
      const shares = kind === 'history' ? row.history_decades : row.recommendation_decades;
      const ridge = decadeRidge(decades, shares, center, direction, maximumShare);
      traces.push({ type: 'scatter', mode: 'lines', x: ridge.x, y: ridge.y, fill: 'toself',
        fillcolor: selected ? (kind === 'history' ? 'rgba(100,116,139,0.36)' : 'rgba(15,118,110,0.36)') : fill,
        line: { color, width: selected ? 2.1 : 1.2 }, showlegend: false, hoverinfo: 'skip' });
      const points = hoverPoints[kind];
      decades.forEach((decade) => {
        const share = shares?.[String(decade)] || 0;
        if (share <= 0) return;
        points.x.push(decade + 5);
        points.y.push(center + direction * Math.min(0.36, (share / maximumShare) * 0.34));
        points.ids.push(row.user_id);
        points.text.push(`User ${row.user_id}<br>${kind === 'history' ? 'History' : 'Recommendations'} · ${decade}s: ${(share * 100).toFixed(1)}%<br>${kind === 'history' ? row.history_known : row.recommendation_known} movies with known years`);
      });
    }
  });

  // Place arrow and hoverable mean markers above the distribution ridges.
  const connectors: Data = { type: 'scatter', mode: 'lines', showlegend: false, hoverinfo: 'skip',
    x: records.flatMap((row) => [row.history_mean_year, row.recommendation_mean_year, null]),
    y: labelValues.flatMap((position) => [position, position, null]),
    line: { color: '#475569', width: 2 } };
  const meanHistory: Data = { type: 'scatter', mode: 'markers', name: 'Historical mean',
    x: records.map((row) => row.history_mean_year), y: labelValues, customdata: records.map((row) => row.user_id),
    text: records.map((row) => `User ${row.user_id}<br>Historical average: ${row.history_mean_year.toFixed(1)}<br>${relativeYearLabel(row.shift_years)}`),
    marker: { color: '#475569', symbol: 'circle', size: records.map((row) => row.user_id === selectedUser ? 13 : 9), line: { color: '#fff', width: 1 } },
    hovertemplate: '%{text}<extra></extra>' };
  const meanRecommended: Data = { type: 'scatter', mode: 'markers', name: 'Recommended mean',
    x: records.map((row) => row.recommendation_mean_year), y: labelValues, customdata: records.map((row) => row.user_id),
    text: records.map((row) => `User ${row.user_id}<br>Recommended average: ${row.recommendation_mean_year.toFixed(1)}<br>${relativeYearLabel(row.shift_years)}`),
    marker: { color: records.map((row) => row.shift_years >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease),
      symbol: records.map((row) => row.shift_years > 0.05 ? 'triangle-right' : row.shift_years < -0.05 ? 'triangle-left' : 'diamond'),
      size: records.map((row) => row.user_id === selectedUser ? 15 : 11), line: { color: '#fff', width: 1 } },
    hovertemplate: '%{text}<extra></extra>' };
  const ridgeHover: Data[] = (['recommendations', 'history'] as const).map((kind) => ({ type: 'scatter', mode: 'markers',
    name: `${kind === 'history' ? 'History' : 'Recommendations'} by decade`, showlegend: false,
    x: hoverPoints[kind].x, y: hoverPoints[kind].y,
    customdata: hoverPoints[kind].ids, text: hoverPoints[kind].text,
    marker: { color: kind === 'history' ? colorHistory : colorRecommendation, size: 5.5, opacity: 0.78 },
    hovertemplate: '%{text}<extra></extra>' } as Data));
  const chartEnd = lastDecade + 10;
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700" aria-label="Release-year chart legend">
      <span><span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-teal-600/60" />Above each arrow: <strong>recommended movie decades</strong></span>
      <span><span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-slate-500/50" />Below each arrow: <strong>historical movie decades</strong></span>
      <span><span className="mr-1.5 font-semibold text-slate-600">● → ▶</span>Arrow: shift in <strong>average release year</strong></span>
    </div>
    <p className="text-xs leading-relaxed text-slate-600">The taller a colored ridge is within a decade, the larger that decade's share of movies. Ridge heights use <strong>the same scale for every user</strong>. Hover to read exact percentages; click an arrow or ridge point for details. These are decade buckets, not a continuous year-by-year density.</p>
    <div className="max-h-[790px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <PlotFrame title="Each user's release-year shift and decade distributions"
        note="Release years run left to right. Every user has three aligned elements: recommendations above, the average-year arrow in the middle, and history below. Scroll to see all users."
        data={records.length ? [...traces, connectors, ...ridgeHover, meanHistory, meanRecommended] : []}
        height={Math.max(380, records.length * 73 + 126)}
        layout={{ margin: { l: 95, r: 22, b: 24, t: 72 }, showlegend: false,
          xaxis: { title: { text: 'Movie release year (decade buckets for distributions)' }, side: 'top', range: [firstDecade - 2, chartEnd + 2], tick0: firstDecade, dtick: decades.length > 11 ? 20 : 10, tickformat: 'd' },
          yaxis: { tickmode: 'array', tickvals: labelValues, ticktext: records.map((row) => `User ${row.user_id}`),
            range: [-0.65, records.length - 0.35], fixedrange: true, showgrid: false, zeroline: false },
          shapes: selectedUser != null && records.some((row) => row.user_id === selectedUser) ? [{ type: 'rect', xref: 'x', yref: 'y',
            x0: firstDecade - 2, x1: chartEnd + 2,
            y0: labelValues[records.findIndex((row) => row.user_id === selectedUser)] - 0.46,
            y1: labelValues[records.findIndex((row) => row.user_id === selectedUser)] + 0.46,
            fillcolor: 'rgba(15,118,110,0.06)', line: { color: 'rgba(15,118,110,0.18)', width: 1 }, layer: 'below' }] : [] }}
        onPoint={(point) => { if (point.customdata !== undefined) onSelect(Number(point.customdata)); }} />
    </div>
  </div>;
}
