import type { Data } from 'plotly.js';
import PlotFrame from '../PlotFrame';
import { CHANGE_COLORS } from '../../lib/visualizationData';

type Item = { genre: string; history: number; recommended: number };
type Props = { items: Item[]; selectedGenre: string | null; onSelect: (genre: string) => void; showAll: boolean };

export default function GenreDumbbellChart({ items, selectedGenre, onSelect, showAll }: Props) {
  const sorted = [...items].sort((a, b) => Math.abs(b.recommended - b.history) - Math.abs(a.recommended - a.history) || a.genre.localeCompare(b.genre));
  const shown = showAll ? sorted : sorted.slice(0, 8);
  const names = shown.map((item) => item.genre);
  const connections: Data = { type: 'scatter', mode: 'lines', showlegend: false, hoverinfo: 'skip',
    x: shown.flatMap((item) => [item.history * 100, item.recommended * 100, null]),
    y: names.flatMap((name) => [name, name, null]), line: { color: '#94a3b8', width: 2 } };
  const dots: Data[] = [
    { field: 'history' as const, label: 'History', color: CHANGE_COLORS.baseline, symbol: 'circle' as const },
    { field: 'recommended' as const, label: 'Recommendations', color: CHANGE_COLORS.increase, symbol: 'diamond' as const },
  ].map(({ field, label, color, symbol }) => ({ type: 'scatter', mode: 'markers', name: label, x: shown.map((item) => item[field] * 100),
    y: names, customdata: names, text: shown.map((item) => `History: ${(item.history * 100).toFixed(1)}%<br>Recommendations: ${(item.recommended * 100).toFixed(1)}%<br>Change: ${((item.recommended - item.history) * 100).toFixed(1)} pp`),
    marker: { color, symbol, size: shown.map((item) => item.genre === selectedGenre ? 15 : 11),
      line: { color: '#ffffff', width: 1 } },
    hovertemplate: '%{y}<br>%{text}<extra></extra>' } as Data));
  return <PlotFrame title="Which genres changed for this user?"
    note="Gray dots are shares in the movie history; teal diamonds are shares in recommendations. The connecting line shows the size and direction of the change. Select a genre to highlight its movies."
    data={[connections, ...dots]} height={Math.max(360, shown.length * 32 + 140)}
    layout={{ margin: { l: 115, r: 25, t: 34, b: 60 },
      xaxis: { title: { text: 'Share of movies (%)' }, range: [0, 100], ticksuffix: '%' },
      yaxis: { categoryorder: 'array', categoryarray: names, autorange: 'reversed' },
      legend: { orientation: 'h', y: 1.12 } }}
    onPoint={(point) => { if (point.customdata !== undefined) onSelect(String(point.customdata)); }} />;
}
