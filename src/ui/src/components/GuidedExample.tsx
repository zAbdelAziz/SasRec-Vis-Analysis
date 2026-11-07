import { useState } from 'react';
import { CHANGE_COLORS } from '../lib/visualizationData';

type Kind = 'genre' | 'year';

/** Interactive *illustrations* of visual encodings, never synthetic SASRec results. */
export default function GuidedExample({ kind }: { kind: Kind }) {
  const [historyShare, setHistoryShare] = useState(25);
  const [recommendedShare, setRecommendedShare] = useState(40);
  const [historyYear, setHistoryYear] = useState(1980);
  const [recommendedYear, setRecommendedYear] = useState(1995);
  const delta = recommendedShare - historyShare;
  const years = recommendedYear - historyYear;
  return <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-slate-800">Try a short interactive example (illustrative, not model output)</summary>
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Illustrative teaching example; not a measured finding from SASRec</p>
      {kind === 'genre' && <>
        <p className="text-slate-600">Imagine a single genre such as Drama. Move the sliders to see how the same comparison is expressed in the charts.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 font-medium">Share of Drama in movie history: {historyShare}%
            <input aria-label="Illustrative history genre share" className="block w-full accent-teal-700" type="range" min="0" max="100" step="5" value={historyShare} onChange={(event) => setHistoryShare(Number(event.target.value))} />
          </label>
          <label className="space-y-1 font-medium">Share of Drama in recommendations: {recommendedShare}%
            <input aria-label="Illustrative recommended genre share" className="block w-full accent-teal-700" type="range" min="0" max="100" step="5" value={recommendedShare} onChange={(event) => setRecommendedShare(Number(event.target.value))} />
          </label>
        </div>
        <div className="space-y-2">
          {[['History', historyShare], ['Recommendations', recommendedShare]] .map(([label, value]) =>
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-medium">{label}</span>
              <div className="h-3 min-w-0 flex-1 rounded bg-slate-200"><div className="h-3 rounded bg-teal-700" style={{ width: `${value}%` }} /></div>
              <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{value}%</span>
            </div>)}
        </div>
        <p className="rounded-lg bg-white p-3 font-semibold" style={{ color: delta >= 0 ? CHANGE_COLORS.increase : CHANGE_COLORS.decrease }}>
          {delta > 0 ? '+' : ''}{delta} percentage points {delta > 0 ? '(more prominent)' : delta < 0 ? '(less prominent)' : '(unchanged)'}.
        </p>
      </>}
      {kind === 'year' && <>
        <p className="text-slate-600">Move either average release year. The measured H8 chart uses one such comparison per user.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 font-medium">Historical average: {historyYear}
            <input aria-label="Illustrative history release year" className="block w-full accent-teal-700" type="range" min="1920" max="2000" value={historyYear} onChange={(event) => setHistoryYear(Number(event.target.value))} />
          </label>
          <label className="space-y-1 font-medium">Recommendation average: {recommendedYear}
            <input aria-label="Illustrative recommendation release year" className="block w-full accent-teal-700" type="range" min="1920" max="2000" value={recommendedYear} onChange={(event) => setRecommendedYear(Number(event.target.value))} />
          </label>
        </div>
        <div className="relative mx-3 h-16 border-b border-slate-300" aria-label={`History ${historyYear}, recommendations ${recommendedYear}`}>
          <div className="absolute top-7 h-1 bg-slate-400" style={{ left: `${(Math.min(historyYear, recommendedYear) - 1920) / 80 * 100}%`, width: `${Math.abs(years) / 80 * 100}%` }} />
          <span className="absolute top-5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-500" style={{ left: `${(historyYear - 1920) / 80 * 100}%` }} title="History" />
          <span className="absolute top-5 h-5 w-5 -translate-x-1/2 rotate-45 border-2 border-white bg-teal-600" style={{ left: `${(recommendedYear - 1920) / 80 * 100}%` }} title="Recommendations" />
          <span className="absolute bottom-0 left-0 text-xs text-slate-500">1920</span><span className="absolute bottom-0 right-0 text-xs text-slate-500">2000</span>
        </div>
        <p className="rounded-lg bg-white p-3 font-semibold">{years > 0 ? `+${years} years: newer releases on average` : years < 0 ? `${years} years: older releases on average` : 'No difference in average release year'}</p>
      </>}
    </div>
  </details>;
}
