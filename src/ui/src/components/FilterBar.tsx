import { useAnalysisStore } from '../store/useAnalysisStore';

type Props = { scope: string; filters: Array<{ key: string; label: string; options: string[] }> };

/** Select the stored reference, not a freshly allocated fallback object.
 * Zustand v5/React 19 require stable snapshots from useSyncExternalStore. */
export default function FilterBar({ scope, filters }: Props) {
  const current = useAnalysisStore((s) => s.filters[scope]);
  const setFilter = useAnalysisStore((s) => s.setFilter);
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-3">
      {filters.map(({ key, label, options }) => <label key={key} className="flex min-w-40 flex-col gap-1 text-xs font-medium text-slate-600">
        {label}
        <select className="field" value={current?.[key] ?? 'all'} onChange={(event) => setFilter(scope, key, event.target.value)}>
          <option value="all">All</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>)}
    </div>
  );
}
