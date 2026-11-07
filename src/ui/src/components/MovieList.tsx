export type Movie = { item_id: number; title: string; genres: string[]; position?: number; rank?: number };
type Props = { title: string; movies: Movie[]; genres?: string[]; activeGenre?: string | null };

export default function MovieList({ title, movies, activeGenre }: Props) {
  const matched = activeGenre ? movies.filter((movie) => movie.genres.includes(activeGenre)).length : null;
  return <section className="surface p-4">
    <h3 className="text-sm font-bold text-slate-900">{title} ({movies.length})</h3>
    {activeGenre && <p className="mt-1 text-xs text-slate-600">{matched} movies tagged {activeGenre}; movies can have multiple genres.</p>}
    <ol className="mt-2 max-h-80 overflow-auto text-sm">
      {movies.map((movie, index) => {
        const highlighted = activeGenre && movie.genres.includes(activeGenre);
        return <li key={`${movie.item_id}-${index}`} className={`border-b border-slate-100 px-2 py-2 ${highlighted ? 'rounded bg-teal-50 ring-1 ring-inset ring-teal-100' : ''}`}>
          <div className="text-slate-800"><span className="mr-2 text-slate-400">{movie.rank ?? movie.position ?? index + 1}.</span>{movie.title}</div>
          <div className="mt-1 flex flex-wrap gap-1">{movie.genres.map((genre) => <span key={genre}
            className={`rounded px-1.5 py-0.5 text-[11px] ${genre === activeGenre ? 'bg-teal-100 font-semibold text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{genre}</span>)}</div>
        </li>;
      })}
    </ol>
  </section>;
}
