type Metric = { label: string; value: string; note?: string };
export default function InsightSummary({ metrics }: { metrics: Metric[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
    {metrics.map((metric) => <div key={metric.label} className="surface px-5 py-4">
      <p className="text-xs font-semibold text-slate-600">{metric.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{metric.value}</p>
      {metric.note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{metric.note}</p>}
    </div>)}
  </div>;
}
