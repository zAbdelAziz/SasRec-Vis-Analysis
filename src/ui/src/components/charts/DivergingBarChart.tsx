import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import { CHANGE_COLORS, ppValueLabel, percentLabel } from '../../lib/visualizationData';

type Datum = { userId: string; genre: string; historyShare: number; recommendationShare: number; differencePp: number };
type Props = { values: Datum[]; selectedId: string; onSelect: (id: string) => void };

export default function DivergingBarChart({ values, selectedId, onSelect }: Props) {
  const labels = values.map((item) => `User ${item.userId} · ${item.genre}`);
  const maxMagnitude = Math.max(5, ...values.map((item) => Math.abs(item.differencePp)));
  const series: Data[] = values.length ? [{ type: 'bar', orientation: 'h', name: 'Change',
    x: values.map((item) => item.differencePp), y: labels, customdata: values.map((item) => item.userId),
    text: values.map((item) => `${percentLabel(item.historyShare)} → ${percentLabel(item.recommendationShare)} (${ppValueLabel(item.differencePp)})`),
    marker: { color: values.map((item) => item.differencePp >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease),
      line: { color: values.map((item) => item.userId === selectedId ? '#0f172a' : '#ffffff'), width: values.map((item) => item.userId === selectedId ? 2 : 0) } },
    hovertemplate: '%{y}<br>History → recommendations: %{text}<extra></extra>' }] : [];
  return <PlotFrame title="How each user's main genre changed"
    note="Each row shows one user's most common genre in their history. Right of zero = a larger share in recommendations; left = a smaller share. Select a bar to inspect its movies."
    data={series} height={Math.max(360, values.length * 29 + 130)}
    layout={{ margin: { l: 205, r: 30, t: 18, b: 65 }, showlegend: false,
      xaxis: { title: { text: 'Change in share (percentage points)' }, range: [-maxMagnitude * 1.17, maxMagnitude * 1.17], zeroline: true, zerolinecolor: '#475569', ticksuffix: ' pp' },
      yaxis: { categoryorder: 'array', categoryarray: labels, autorange: 'reversed' } }}
    onPoint={(point) => { if (point.customdata !== undefined) onSelect(String(point.customdata)); }} />;
}
