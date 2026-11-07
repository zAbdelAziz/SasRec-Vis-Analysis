type Props = { title?: string; children: React.ReactNode };
export default function VisualizationExplanation({ title = 'How this analysis works', children }: Props) {
  return <details className="surface group p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-slate-800 marker:text-teal-700">{title}</summary>
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 leading-relaxed text-slate-600">{children}</div>
  </details>;
}
