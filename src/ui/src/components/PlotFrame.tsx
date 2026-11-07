import Plot from 'react-plotly.js';
import type { Data, Layout } from 'plotly.js';

export type ChartPoint = { x?: unknown; y?: unknown; pointIndex?: unknown; customdata?: unknown };
type Props = {
  title: string;
  note?: string;
  data: Data[];
  layout?: Partial<Layout>;
  height?: number;
  onPoint?: (point: ChartPoint) => void;
};

export default function PlotFrame({ title, note, data, layout, height = 330, onPoint }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>}
      {!data.length ? <div className="mt-4 grid h-48 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Not enough observations for this view.</div> :
        <Plot
          data={data}
          layout={{ autosize: true, height, paper_bgcolor: 'white', plot_bgcolor: 'white',
            font: { family: 'Inter, system-ui, sans-serif', color: '#475569', size: 11 },
            margin: { t: 18, r: 24, b: 56, l: 60 },
            hovermode: 'closest', ...layout }}
          useResizeHandler
          style={{ width: '100%', height }}
          config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] }}
          onClick={(event) => { if (event.points[0]) onPoint?.(event.points[0]); }}
        />}
    </div>
  );
}
