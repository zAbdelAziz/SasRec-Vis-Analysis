import { rows, num, str } from '../lib/records';
import type { RawRow } from '../types/api';

const GROUPS = ['Q1 rare', 'Q2', 'Q3', 'Q4', 'Q5 popular'];
const BANDS = ['Far (15-18 before end)', 'Middle (10-14)', 'Near (6-9)'];

type Props = { sampling: RawRow | null; observed: RawRow[]; saved: RawRow[] };

/** Distinguish eligible opportunities, sampled events, and inspectable examples. */
export default function H6SamplingCoverage({ sampling, observed, saved }: Props) {
  if (!sampling || str(sampling, 'strategy') !== 'stratified_popularity_position_v2') {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <strong>Earlier-run results:</strong> This cached analysis used the original user-first sampling method.
      Eligible-opportunity totals were not recorded, so coverage cannot be inferred from the plotted observations.
      The updated stratified algorithm will be used on the next run; old results are not changed automatically.
    </div>;
  }
  const byGroup = rows(sampling.by_popularity);
  const byCell = rows(sampling.by_popularity_position);
  const formatted = (row: RawRow | undefined, field: string) => row ? String(num(row, field)) : '0';
  return <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-slate-800">Sampling coverage: what could have been tested?</summary>
    <p className="mt-3 text-xs leading-relaxed text-slate-600">
      {num(sampling, 'eligible_users')} users had {num(sampling, 'available_swap_opportunities')} eligible non-identical swaps.
      The analysis sampled {num(sampling, 'sampled_users')} users and {observed.length} swaps, saving {saved.length} detailed cases.
      A maximum of {num(sampling, 'max_swaps_per_user')} swaps per selected user was scored. Groups are deliberately balanced
      for exploration, so the overall mean is <strong>not</strong> a population-weighted estimate.
    </p>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-700"><tr>
          <th scope="col" className="p-2">Popularity</th>
          <th scope="col" className="p-2">Eligible swaps</th>
          <th scope="col" className="p-2">Measured</th>
          <th scope="col" className="p-2">Users measured</th>
          <th scope="col" className="p-2">Saved details</th>
        </tr></thead>
        <tbody>{GROUPS.map((group) => {
          const item = byGroup.find((row) => str(row, 'group') === group);
          return <tr key={group} className="border-t border-slate-100">
            <th scope="row" className="p-2 font-medium">{group}</th>
            <td className="p-2 tabular-nums">{formatted(item, 'eligible')}</td>
            <td className="p-2 tabular-nums">{formatted(item, 'sampled')}</td>
            <td className="p-2 tabular-nums">{formatted(item, 'sampled_users')}</td>
            <td className="p-2 tabular-nums">{formatted(item, 'saved_cases')}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <h4 className="mt-4 text-sm font-semibold text-slate-800">Coverage by position</h4>
    <p className="mt-1 text-xs text-slate-500">Each cell shows measured / eligible swaps. 0 / 0 means there were no eligible opportunities; 0 / N means the sample did not cover that cell.</p>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50"><tr><th scope="col" className="p-2">Popularity</th>{BANDS.map((band) =>
          <th scope="col" className="p-2" key={band}>{band}</th>)}</tr></thead>
        <tbody>{GROUPS.map((group) => <tr key={group} className="border-t border-slate-100"><th scope="row" className="p-2 font-medium">{group}</th>{BANDS.map((band) => {
          const item = byCell.find((row) => str(row, 'group') === group && str(row, 'band') === band);
          const eligible = num(item ?? {}, 'eligible');
          const sampled = num(item ?? {}, 'sampled');
          return <td key={band} className={`p-2 tabular-nums ${!sampled && eligible ? 'bg-amber-50 text-amber-900' : !eligible ? 'text-slate-400' : 'text-slate-700'}`}>
            {sampled} / {eligible}
          </td>;
        })}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}
