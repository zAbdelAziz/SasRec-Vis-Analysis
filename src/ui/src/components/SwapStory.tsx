import { arrayNum, num, str } from '../lib/records';
import type { RawRow } from '../types/api';

type Props = { example: RawRow; names: Map<number,string> };

/** A true two-item swap: show both changed positions, not just the selected movie. */
export default function SwapStory({ example, names }: Props) {
  const original = arrayNum(example.original);
  const modified = arrayNum(example.modified);
  if (!original.length || original.length !== modified.length) return null;
  const different = original.flatMap((movie, index) => movie !== modified[index] ? [index] : []);
  const isSwap = different.length === 2 && original[different[0]] === modified[different[1]] && original[different[1]] === modified[different[0]];
  const title = (id: number) => names.get(id) ?? `Movie #${id}`;
  const slot = (index: number) => `${original.length - index} positions before the end`;
  return <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-teal-200">
    <div><p className="section-label text-teal-700">Controlled history swap</p>
      <h4 className="mt-1 text-base font-bold text-slate-900">Two historical movies exchanged positions</h4>
      <p className="mt-1 text-xs text-slate-600">User {str(example, 'user_id')} · selected movie had {num(example, 'popularity')} training interactions ({str(example, 'popularity_bin')}). Both movies move when their positions are swapped.</p>
    </div>
    {isSwap && <div className="grid gap-3 md:grid-cols-2">
      {different.map((index) => <div key={index} className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
        <span className="block text-xs font-semibold text-teal-900">Original: {slot(index)}</span>
        <strong className="mt-1 block text-slate-800">{title(original[index])}</strong>
        <span className="mt-1 block text-xs text-slate-600">Moves to {slot(different.find((other) => other !== index)!)}.</span>
      </div>)}
    </div>}
    <div className="grid gap-3 lg:grid-cols-2">
      {([{ label: 'Original sequence', movies: original },{ label: 'After the swap', movies: modified }]).map(({ label, movies }) =>
        <div key={label} className="rounded-lg border border-slate-200 p-3">
          <h5 className="mb-2 text-sm font-bold text-slate-900">{label}</h5>
          <ol className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {movies.map((movie, index) => <li key={`${movie}-${index}`} className={`flex gap-2 rounded px-2 py-1 ${different.includes(index) ? 'bg-teal-100 font-semibold text-teal-900' : 'text-slate-600'}`}>
              <span className="w-10 shrink-0 tabular-nums text-slate-400">{index + 1}.</span>
              <span>{title(movie)}{different.includes(index) ? ' ← swapped' : ''}</span>
            </li>)}
          </ol>
        </div>)}
    </div>
    {!isSwap && <p className="text-xs text-amber-800">The stored sequences differ at {different.length} positions; the display highlights the exact changes without assuming an ordinary two-position swap.</p>}
  </section>;
}
