import { useEffect, useState } from 'react';
import type { Data, Layout } from 'plotly.js';
import { api } from '../api/client';
import PlotFrame from '../components/PlotFrame';
import type { AnalysisResult, NotebookUserDetail, RawRow } from '../types/api';

/** Interactive charts of the preserved Pair B research measurements. */
const number = (row: RawRow, key: string) => Number(row[key] ?? 0);
const label = (row: RawRow, key: string) => String(row[key] ?? '');
const share = (value: number) => `${(100 * value).toFixed(1)}%`;
const npp = (value: number) => `${value >= 0 ? '+' : ''}${(100 * value).toFixed(2)} pp`;
const TEAL = '#267c8d';
const ORANGE = '#d17a40';
const GRAY = '#9aa6b2';
const simpleLayout: Partial<Layout> = { margin: { l: 98, r: 26, t: 14, b: 62 }, hovermode: 'closest' };
const list = (value: unknown): RawRow[] => Array.isArray(value) ? value as RawRow[] : [];

type Props = { result: AnalysisResult };

function NotebookUser({ hypothesis, id, runId }: { hypothesis: string; id: number; runId?: string }) {
  const [detail, setDetail] = useState<NotebookUserDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError('');
    void api.notebookUserDetail(hypothesis, id, runId).then(value => { if (!cancelled) setDetail(value); })
      .catch((cause: Error) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [hypothesis, id, runId]);
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!detail) return <p className="text-xs text-slate-500">Loading user {id}…</p>;
  const titles = list(detail.tables.top20_recommendations);
  const examples = list(detail.tables.tie_order_sensitive_examples);
  const profiles = list(detail.tables.user_genre_profiles);
  const popularity = list(detail.tables.user_popularity_exposure);
  return <div className="space-y-3 text-sm">
    <div className="font-semibold text-slate-800">User {id}</div>
    {profiles.length > 0 && <PlotFrame title="This user's genre shares" height={360} note="Gray = history · teal = recommendations. Each connection is one genre."
      data={[
        {type:'scatter',mode:'lines',x:profiles.flatMap(row=>[100*number(row,'history_share'),100*number(row,'recommendation_share'),null]),
          y:profiles.flatMap(row=>[label(row,'genre'),label(row,'genre'),null]),line:{color:'#cbd5e1',width:2},hoverinfo:'skip',showlegend:false},
        {type:'scatter',mode:'markers',x:profiles.map(row=>100*number(row,'history_share')),
          y:profiles.map(row=>label(row,'genre')),name:'History',marker:{size:8,color:GRAY},hovertemplate:'%{y}: %{x:.1f}% history<extra></extra>'},
        {type:'scatter',mode:'markers',x:profiles.map(row=>100*number(row,'recommendation_share')),
          y:profiles.map(row=>label(row,'genre')),name:'Recommendations',marker:{size:9,color:TEAL,symbol:'diamond'},hovertemplate:'%{y}: %{x:.1f}% recommended<extra></extra>'}
      ] as Data[]}
      layout={{margin:{l:102,r:15,t:28,b:48},legend:{orientation:'h',y:1.23},xaxis:{title:{text:'Share (%)'},rangemode:'tozero'},yaxis:{automargin:true}}} />}
    {profiles.length > 0 && <details className="rounded-lg border border-slate-200 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold">Exact genre percentages</summary><div className="mt-2 max-h-52 overflow-y-auto">
      <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-2">Genre</th><th className="p-2">History</th><th className="p-2">Recommendations</th><th className="p-2">Change</th></tr></thead><tbody>
      {profiles.slice().sort((a,b) => Math.abs(number(b,'delta_recommendation_minus_history')) - Math.abs(number(a,'delta_recommendation_minus_history'))).map(row =>
        <tr key={label(row,'genre')} className="border-t border-slate-100"><td className="p-2">{label(row,'genre')}</td><td className="p-2 tabular-nums">{share(number(row,'history_share'))}</td><td className="p-2 tabular-nums">{share(number(row,'recommendation_share'))}</td><td className="p-2 tabular-nums">{npp(number(row,'delta_recommendation_minus_history'))}</td></tr>)}</tbody></table>
    </div></details>}
    {popularity.length > 0 && <div className="flex flex-wrap gap-3 text-xs">
      {popularity.map(row => <span key={label(row,'popularity_quintile')} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">{label(row,'popularity_quintile')}: {share(number(row,'latest20_history_share'))} history → {share(number(row,'recommendation_exposure_share'))} recommended</span>)}
    </div>}
    {titles.length > 0 && <details open className="rounded-lg border border-slate-200 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold">Actual Top-20 recommendations</summary>
      <ol className="mt-2 max-h-56 list-decimal space-y-1 overflow-y-auto pl-5 text-xs text-slate-600">
        {titles.slice().sort((a,b) => number(a,'rank')-number(b,'rank')).map(movie => <li key={number(movie,'rank')}>
          <span className="font-medium text-slate-800">{label(movie,'title')}</span> · {label(movie,'genres')}
        </li>)}
      </ol>
    </details>}
    {hypothesis === 'h5' && (examples.length ? <div className="grid gap-3 lg:grid-cols-2">
      {([['canonical_rank', 'Original ranking'], ['tie_reversed_rank', 'Tie-reversed ranking']] as const).map(([key, heading]) =>
        <div key={key} className="rounded-lg border border-slate-200 p-3"><h4 className="mb-2 text-xs font-semibold">{heading}</h4>
          <ol className="max-h-72 list-decimal space-y-1 overflow-auto pl-5 text-xs text-slate-600">
            {examples.filter(row => row[key] !== null && row[key] !== undefined).sort((a,b) => number(a,key)-number(b,key))
              .map(row => <li key={label(row,'sas_item_id')}>{label(row,'title')} <span className="text-slate-400">({label(row,'genres')})</span></li>)}
          </ol></div>)}
    </div> : <p className="text-xs text-amber-700">Full before/after rankings are available for the 12 most-sensitive users.</p>)}
  </div>;
}

function H1Notebook({ result, runId }: { result: AnalysisResult; runId?: string }) {
  const rows = list(result.views.genre_share).slice().sort((a,b) => number(a,'delta_mean') - number(b,'delta_mean'));
  const [genre, setGenre] = useState('Comedy');
  const [userInput, setUserInput] = useState('1');
  const [userId, setUserId] = useState(1);
  const x = rows.map(row => 100 * number(row,'delta_mean'));
  const data: Data[] = [{ type: 'scatter', mode: 'markers', x, y: rows.map(row => label(row,'genre')),
    marker: { size: 10, color: rows.map(row => label(row,'genre') === genre ? ORANGE : TEAL) },
    error_x: { type: 'data', symmetric: false, array: rows.map(row => 100*(number(row,'delta_ci_high')-number(row,'delta_mean'))),
      arrayminus: rows.map(row => 100*(number(row,'delta_mean')-number(row,'delta_ci_low'))), color: GRAY, thickness: 1.4, width: 4 },
    hovertemplate: '%{y}: %{x:.2f} percentage points<extra></extra>' }];
  const selected = rows.find(row => label(row,'genre')===genre);
  return <>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Which genres gain or lose share in Top-20 recommendations?" height={490}
        note="6,040 users · recommendation share minus latest-20 history share; 95% user-bootstrap intervals. Select a genre."
        data={data} layout={{...simpleLayout, margin:{l:125,r:32,t:8,b:65}, xaxis:{title:{text:'Change in share (percentage points)'},zeroline:true,zerolinewidth:2},yaxis:{automargin:true}}}
        onPoint={point => setGenre(String(point.y))} />
      <section className="surface p-4">
        <h3 className="text-sm font-bold">Inspect a genre and an actual user</h3>
        <div className="my-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">Genre<select className="ml-2 rounded-lg border border-slate-300 px-2 py-1.5" value={genre} onChange={e=>setGenre(e.target.value)}>{rows.map(row=><option key={label(row,'genre')}>{label(row,'genre')}</option>)}</select></label>
          <form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();const id=Number(userInput);if(Number.isInteger(id)&&id>=1&&id<=6040)setUserId(id);}}>
            <label className="text-xs text-slate-600">User ID<input type="number" min={1} max={6040} className="ml-2 w-20 rounded-lg border border-slate-300 px-2 py-1.5" value={userInput} onChange={e=>setUserInput(e.target.value)} /></label>
            <button type="submit" className="btn-muted">Inspect</button>
          </form>
        </div>
        {selected && <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><strong>{genre}</strong>: {share(number(selected,'history_share_mean'))} in recent history → {share(number(selected,'recommendation_share_mean'))} in recommendations ({npp(number(selected,'delta_mean'))} across users).</div>}
        <NotebookUser hypothesis="h1" id={userId} runId={runId} />
      </section>
    </div>
  </>;
}

function H4Notebook({ result, runId }: { result: AnalysisResult; runId?: string }) {
  const rows = list(result.views.popularity_profile);
  const bins = list(result.views.q5_hex_bins);
  const diversity = list(result.views.genre_diversity);
  const change = list(result.views.q5_shift)[0];
  const [userId, setUserId] = useState(1);
  const [userInput, setUserInput] = useState('1');
  const quintile = rows.map(row => label(row,'popularity_quintile'));
  const bars: Data[] = ([['latest20_history_share','Recent history', '#62A879'],['unseen_catalog_share','Unseen catalog',GRAY],['recommendation_exposure_share','SASRec Top-20',TEAL]] as const).map(([key,name,color])=>({type:'bar' as const, name, x:quintile, y:rows.map(row=>100*number(row,key)),marker:{color},hovertemplate:'%{x}<br>%{y:.1f}%<extra>'+name+'</extra>'}));
  const hex: Data[] = [{type:'scatter', mode:'markers',x:bins.map(row=>100*number(row,'history_q5_share')),
    y:bins.map(row=>100*number(row,'recommendation_q5_share')),
    customdata:bins.map(row=>[number(row,'users'),number(row,'example_user_id')]),
    marker:{symbol:'hexagon',size:14,color:bins.map(row=>Math.log10(1+number(row,'users'))),colorscale:'Blues',
      colorbar:{title:{text:'log₁₀(users+1)'}},showscale:true,line:{color:'#c6d5e0',width:0.3}},
    hovertemplate:'History: %{x:.1f}%<br>Recommended: %{y:.1f}%<br>Users in hex: %{customdata[0]}<br>Nearby example user: %{customdata[1]}<extra></extra>'}];
  const diversityTraces: Data[] = ([['mean_q5_unseen_catalog_share','Unseen catalog',GRAY],['mean_q5_recommendation_share','SASRec Top-20',TEAL]] as const).map(([key,name,color])=>({type:'bar' as const,name, x:diversity.map(r=>label(r,'genre_mix_band')), y:diversity.map(r=>100*number(r,key)),marker:{color}}));
  return <>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Popularity of history, catalog, and recommendations" height={420}
        note="Five equal-sized groups of movies ranked by training interactions; values are mean per-user shares."
        data={bars} layout={{barmode:'group', margin:{l:64,r:16,t:12,b:74},legend:{orientation:'h',y:1.22}, yaxis:{title:{text:'Share (%)'},rangemode:'tozero'},xaxis:{title:{text:'Movie popularity quintile'}}}} />
      <PlotFrame title="Popular-movie exposure across individual users" height={420}
        note={`${change ? `${number(change,'recommendation_q5_share_higher').toLocaleString()} of 6,040 users have a higher Q5 share` : 'Individual users'} · log-colored hexagonal counts. Select a hexagon to inspect a nearby user.`}
        data={hex} layout={{margin:{l:67,r:28,t:12,b:73},xaxis:{title:{text:'History Q5 share (%)'},range:[0,100]},
          yaxis:{title:{text:'Recommended Q5 share (%)'},range:[0,100]},shapes:[{type:'line',x0:0,x1:100,y0:0,y1:100,line:{dash:'dash',color:ORANGE,width:1.5}}]}}
        onPoint={point=>{const pair=point.customdata as number[] | undefined; if(Array.isArray(pair) && Number.isInteger(pair[1])) {setUserId(pair[1]);setUserInput(String(pair[1]));}}} />
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Popularity exposure by recent genre diversity" height={330}
        note="Compare the Q5 catalog reference with recommendation exposure across three history-diversity groups."
        data={diversityTraces} layout={{barmode:'group',margin:{l:55,r:12,t:16,b:78},legend:{orientation:'h',y:1.22},yaxis:{title:{text:'Q5 share (%)'}}}} />
      <section className="surface p-4">
        <h3 className="text-sm font-bold">Selected user's popularity profile</h3>
        <form className="my-3 flex items-center gap-2" onSubmit={e=>{e.preventDefault();const id=Number(userInput);if(Number.isInteger(id)&&id>=1&&id<=6040)setUserId(id);}}>
          <label className="text-xs text-slate-600">User ID<input type="number" min={1} max={6040} className="ml-2 w-24 rounded-lg border border-slate-300 px-2 py-1" value={userInput} onChange={e=>setUserInput(e.target.value)} /></label>
          <button className="btn-muted" type="submit">Inspect</button>
        </form>
        <NotebookUser hypothesis="h4" id={userId} runId={runId} />
      </section>
    </div>
  </>;
}

function DemographicSupplement() {
  const [rows, setRows] = useState<RawRow[]>([]);
  const [genre, setGenre] = useState('Drama');
  useEffect(() => {
    let cancelled = false;
    void api.notebookTable('demographic_genre_summary', {limit:500}).then(result => {
      if (!cancelled) setRows(result.rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const genres = [...new Set(rows.map(row => label(row,'genre')))].sort();
  return <div className="mt-4 border-t border-slate-200 pt-3">
    <div className="flex flex-wrap items-center gap-3">
      <h4 className="text-xs font-semibold text-slate-800">Supporting demographic genre summary</h4>
      <select aria-label="Supporting genre" className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={genre} onChange={e => setGenre(e.target.value)}>
        {genres.map(g => <option key={g}>{g}</option>)}
      </select>
    </div>
    {!rows.length ? <p className="mt-2 text-xs text-slate-500">Loading summary…</p> :
      <div className="mt-2 max-h-52 overflow-auto"><table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2">Age code</th><th className="p-2">Gender</th><th className="p-2">Users</th><th className="p-2">Mean change</th><th className="p-2">95% bootstrap interval</th></tr></thead><tbody>
          {rows.filter(row => label(row,'genre') === genre).map(row => <tr key={`${label(row,'age_code')}-${label(row,'gender')}`} className="border-t border-slate-100">
            <td className="p-2">{label(row,'age_code')}</td><td className="p-2">{label(row,'gender')}</td><td className="p-2">{number(row,'users')}</td>
            <td className="p-2 tabular-nums">{npp(number(row,'delta_mean'))}</td><td className="p-2 tabular-nums">{npp(number(row,'ci_low'))} to {npp(number(row,'ci_high'))}</td></tr>)}
        </tbody></table></div>}
  </div>;
}

function H5Notebook({ result, runId }: { result: AnalysisResult; runId?: string }) {
  const rows = list(result.views.tie_sensitivity);
  const latest = list(result.views.latest_tie_size);
  const examples = list(result.views.sensitive_users);
  const [band, setBand] = useState('');
  const [userId, setUserId] = useState(number(examples[0] ?? {},'user_id') || 1);
  const cats = rows.map(row=>label(row,'tie_group_band'));
  const supported = rows.filter(row => row.rbo_ci_high!=null && row.rbo_ci_low!=null);
  const unsupported = rows.filter(row => row.rbo_ci_high==null || row.rbo_ci_low==null);
  const rank: Data[] = [{type:'scatter',mode:'markers',x:supported.map(row=>label(row,'tie_group_band')),
    y:supported.map(row=>number(row,'mean_rbo_dissimilarity')),
    marker:{size:11,color:supported.map(row=>label(row,'tie_group_band')===band?ORANGE:TEAL)},
    error_y:{type:'data',symmetric:false,array:supported.map(row=>number(row,'rbo_ci_high')-number(row,'mean_rbo_dissimilarity')),
      arrayminus:supported.map(row=>number(row,'mean_rbo_dissimilarity')-number(row,'rbo_ci_low')),color:GRAY,width:5},
    text:supported.map(row=>`n=${number(row,'users').toLocaleString()}`),
    hovertemplate:'%{x}<br>Mean RBO dissimilarity: %{y:.3f}<br>%{text}<extra></extra>'},
    ...(unsupported.length ? [{type:'scatter' as const,mode:'markers' as const,
      x:unsupported.map(row=>label(row,'tie_group_band')),
      y:unsupported.map(row=>number(row,'mean_rbo_dissimilarity')),
      marker:{symbol:'x',size:11,color:ORANGE},
      text:unsupported.map(row=>`n=${number(row,'users')} · interval unavailable`),
      hovertemplate:'%{x}<br>Mean RBO dissimilarity: %{y:.3f}<br>%{text}<extra></extra>'} as Data] : [])];
  const membership: Data[] = [{type:'bar',x:cats,y:rows.map(row=>number(row,'top20_set_changed_percent')),
    marker:{color:rows.map(row=>label(row,'tie_group_band')===band?TEAL:ORANGE)},
    text:rows.map(row=>`n=${number(row,'users').toLocaleString()}`),hovertemplate:'%{x}<br>%{y:.1f}% changed Top-20 membership<br>%{text}<extra></extra>'}];
  const latestData: Data[] = [{type:'scatter', mode:'lines+markers',x:latest.map(row=>label(row,'latest_tie_band')),
    y:latest.map(row=>number(row,'mean_rbo_dissimilarity')),line:{color:TEAL}, marker:{size:10},
    text:latest.map(row=>`n=${number(row,'users')}`),error_y:{type:'data',symmetric:false,
      array:latest.map(row=>number(row,'rbo_ci_high')-number(row,'mean_rbo_dissimilarity')),
      arrayminus:latest.map(row=>number(row,'mean_rbo_dissimilarity')-number(row,'rbo_ci_low'))},
    hovertemplate:'%{x}<br>Mean RBO difference: %{y:.3f}<br>%{text}<extra></extra>'}];
  return <>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Ranking changes under same-second tie reversal" height={355}
        note="Each point is a group mean, with a 95% user-bootstrap interval when sufficiently sampled. 0 means identical ranking."
        data={rank} layout={{margin:{l:64,r:10,t:10,b:68},xaxis:{title:{text:'Tied timestamp groups'}},yaxis:{title:{text:'RBO dissimilarity'},rangemode:'tozero'}}}
        onPoint={point=>setBand(String(point.x))} />
      <PlotFrame title="How many users get different recommended movies?" height={355}
        note="Share of users whose Top-20 contains at least one different movie after the tie reversal."
        data={membership} layout={{margin:{l:62,r:12,t:10,b:68},xaxis:{title:{text:'Tied timestamp groups'}},yaxis:{title:{text:'Users (%)'},range:[0,100]}}}
        onPoint={point=>setBand(String(point.x))} />
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <PlotFrame title="Sensitivity and the latest visible timestamp group" height={350}
        note="All tied groups in the visible history were reversed. This chart groups users only by the size of their latest tied group."
        data={latestData} layout={{margin:{l:68,r:14,t:14,b:95},xaxis:{title:{text:'Latest visible timestamp group size'}},yaxis:{title:{text:'RBO dissimilarity'},rangemode:'tozero'}}} />
      <section className="surface p-4">
        <h3 className="text-sm font-bold">Inspect a before/after example</h3>
        <label className="mt-3 block text-xs text-slate-600">Saved user
          <select className="ml-2 max-w-full rounded-lg border border-slate-300 px-2 py-1.5" value={userId} onChange={e=>setUserId(Number(e.target.value))}>
            {examples.map(row=><option key={number(row,'user_id')} value={number(row,'user_id')}>User {number(row,'user_id')} · RBO {number(row,'rbo_dissimilarity').toFixed(3)}</option>)}
          </select>
        </label>
        <div className="mt-3"><NotebookUser hypothesis="h5" id={userId} runId={runId}/></div>
      </section>
    </div>
  </>;
}

export default function NotebookPhaseOneView({ result }: Props) {
  const runId = typeof result.provenance.generated_run_id === 'string' ? result.provenance.generated_run_id : undefined;
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <span className="text-slate-600">{result.n_records.toLocaleString()} users · Top-20 recommendations</span>
      {runId && <span className="text-xs text-slate-500">Run {runId}</span>}
    </header>
    {result.hypothesis === 'h1' && <H1Notebook result={result} runId={runId} />}
    {result.hypothesis === 'h4' && <H4Notebook result={result} runId={runId} />}
    {result.hypothesis === 'h5' && <H5Notebook result={result} runId={runId} />}
    <details className="surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-slate-800">Additional research findings</summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <figure><figcaption className="mb-2 text-xs font-medium">Release-year comparison</figcaption><img loading="lazy" className="w-full" src="/api/research/phase1/pair-b/figures/release_year_profiles.png" alt="Release-year comparison" /></figure>
        <figure><figcaption className="mb-2 text-xs font-medium">Sampled-negative target hit rate by popularity</figcaption><img loading="lazy" className="w-full" src="/api/research/phase1/pair-b/figures/sampled_test_hit_by_target_popularity.png" alt="Sampled-negative diagnostic hit rates" /></figure>
      </div>
      <DemographicSupplement />
      <p className="mt-2 text-xs text-slate-500">Supporting comparisons provide additional context; H2 and H3 remain Pair A investigations. Full methodology and explanations are available in Research notes below.</p>
    </details>
  </div>;
}
