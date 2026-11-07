import { rows, num, str, arrayNum } from '../lib/records';
import type { RawRow } from '../types/api';

export function MovieLists({ example, window }: { example: RawRow; window: string }) {
  const movies = new Map(rows(example.movies).map((movie) => [num(movie, 'item_id'), movie]));
  const history = arrayNum(example.full_history);
  const lists = [
    { label: 'Movies in this history reference', ids: window === 'recent' ? history.slice(-20) : history },
    { label: 'Recommended movies (rank order)', ids: rows(example.recommendations).map((r) => num(r, 'item_id')) },
  ];
  return <div className="grid gap-4 lg:grid-cols-2">
    {lists.map(({ label, ids }) => <div key={label} className="rounded-lg border border-teal-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">{label}</h3>
      <p className="mt-1 text-xs text-slate-500">{ids.length} movies · verified MovieLens titles</p>
      <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs">
        {ids.map((id, index) => {
          const movie = movies.get(id);
          return <li key={`${id}-${index}`} className="flex items-start gap-2 border-b border-slate-100 pb-2">
            <span className="w-6 shrink-0 text-slate-400">{index + 1}.</span>
            <span className="min-w-0 flex-1"><span className="text-slate-800">{movie ? str(movie, 'title') : `Movie #${id}`}</span>
              <span className="block text-slate-500">{movie && Array.isArray(movie.genres) ? movie.genres.join(' · ') : ''}</span></span>
            <span className="shrink-0 rounded bg-teal-50 px-2 py-1 font-semibold text-teal-800">{movie?.release_year == null ? 'Year unknown' : String(movie.release_year)}</span>
          </li>;
        })}
      </ol>
    </div>)}
  </div>;
}

