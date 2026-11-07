import { rows, num, str, formatNum } from '../lib/records';
import type { RawRow } from '../types/api';

type Props = { left: RawRow; right: RawRow; title?: string; names?: Map<number,string>; readable?: boolean };
export default function RankComparison({ left, right, title = 'Candidate ranking comparison', names, readable = false }: Props) {
  const a = rows(left['items'] ?? left).slice(0, 10);
  const b = rows(right['items'] ?? right).slice(0, 10);
  if (!a.length || !b.length) return null;
  const rankedA = new Map(a.map((r, i) => [str(r, 'item_id'), i + 1]));
  const rankedB = new Map(b.map((r, i) => [str(r, 'item_id'), i + 1]));
  const items = [...new Set([...rankedA.keys(), ...rankedB.keys()])].slice(0, 16);
  if (readable) {
    const titleFor = (item: string) => names?.get(Number(item)) ?? `Movie #${item}`;
    const newItems = b.filter((r) => !rankedA.has(str(r, 'item_id'))).length;
    const lostItems = a.filter((r) => !rankedB.has(str(r, 'item_id'))).length;
    const movement = (item: string, rank: number) => {
      const before = rankedA.get(item);
      if (before == null) return { text: 'Entered top 10', color: 'bg-teal-100 text-teal-800' };
      if (before === rank) return { text: 'Unchanged', color: 'bg-slate-100 text-slate-600' };
      return before > rank ? { text: `↑ ${before - rank} places`, color: 'bg-teal-100 text-teal-800' } :
        { text: `↓ ${rank - before} places`, color: 'bg-orange-100 text-orange-800' };
    };
    return <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-base font-bold text-slate-900">Recommendations before and after</h4>
      <p className="mt-1 text-sm text-slate-600">Compare the first ten recommendations. {newItems} entered the top ten and {lostItems} left it. An item can also change rank without entering or leaving.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3"><h5 className="mb-2 text-sm font-semibold">Before the swap</h5>
          <ol className="space-y-1">{a.map((row, index) => <li key={`${str(row, 'item_id')}-${index}`} className="flex gap-2 rounded border-b border-slate-100 px-2 py-2 text-sm">
            <span className="w-6 shrink-0 font-bold tabular-nums text-slate-400">{index+1}.</span>
            <span className="min-w-0 text-slate-700">{titleFor(str(row, 'item_id'))}</span>
          </li>)}</ol>
        </div>
        <div className="rounded-lg border border-teal-200 p-3"><h5 className="mb-2 text-sm font-semibold">After the swap</h5>
          <ol className="space-y-1">{b.map((row, index) => { const rank = index+1; const change = movement(str(row, 'item_id'), rank);
            return <li key={`${str(row, 'item_id')}-${index}`} className="flex flex-wrap items-center gap-2 rounded border-b border-slate-100 px-2 py-2 text-sm">
              <span className="w-6 shrink-0 font-bold tabular-nums text-slate-400">{rank}.</span>
              <span className="min-w-0 flex-1 text-slate-700">{titleFor(str(row, 'item_id'))}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${change.color}`}>{change.text}</span>
            </li>;
          })}</ol>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Movie titles are shown when verified metadata is available. Rankings are based on SASRec scores, not probabilities.</p>
    </section>;
  }
  const y = (rank: number) => 30 + (rank - 1) * 23;
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <h4 className="mb-3 text-xs font-bold text-slate-700">{title}</h4>
    <div className="overflow-x-auto"><svg viewBox="0 0 540 290" className="min-w-[360px] w-full" role="img" aria-label="Two ranking columns linked by item movements">
      <text x="18" y="15" fontSize="12" fontWeight="bold" fill="#334155">Before</text>
      <text x="370" y="15" fontSize="12" fontWeight="bold" fill="#334155">After</text>
      {items.map((item) => {
        const first = rankedA.get(item) ?? 11;
        const second = rankedB.get(item) ?? 11;
        return <g key={item}>
          <path d={`M 123 ${y(first)} L 353 ${y(second)}`} stroke={first <= 10 && second <= 10 ? '#0f766e' : '#94a3b8'} strokeWidth="1.5" strokeOpacity=".65" />
          <text x="18" y={y(first) + 4} fontSize="11" fill="#334155">{first <= 10 ? `${first}. #${item}` : ''}</text>
          <text x="363" y={y(second) + 4} fontSize="11" fill="#334155">{second <= 10 ? `${second}. #${item}` : ''}</text>
        </g>;
      })}
    </svg></div>
    <p className="mt-1 text-xs text-slate-500">Item IDs are internal SASRec IDs. The diagram displays the top ten positions on each side.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
      <div>Highest before: #{str(a[0], 'item_id')} ({formatNum(num(a[0], 'score'))})</div>
      <div>Highest after: #{str(b[0], 'item_id')} ({formatNum(num(b[0], 'score'))})</div>
    </div>
  </div>;
}
