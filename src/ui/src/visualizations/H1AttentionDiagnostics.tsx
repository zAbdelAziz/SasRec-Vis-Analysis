import type { Data, Layout } from 'plotly.js';
import { useState } from 'react';
import PlotFrame from '../components/PlotFrame';
import type { AnalysisResult } from '../types/api';

type Stat = { query: string; key: string; mean: number|null; median: number|null; std: number|null; count: number; mass: number; users: number; mean_distance: number|null; max_user_fraction: number|null; missing_reason: string|null; nonself: Omit<Stat,'query'|'key'|'nonself'|'missing_reason'> };
type Diagnostics = {
  genre_statistics: Stat[];
  distance: { curves: {distance:number; overlap:boolean; count:number; mean:number|null}[]; summary: { matched_strata:number; matched_users:number; gap:number|null; equal_user_gap:number|null; positive_users:number } };
  movie_matrix: { movies: {item_id:number; title:string; genres:string[]}[]; groups: {genre:string; start:number; count:number; available:number}[]; mean:(number|null)[][]; counts:number[][]; users:number[][]; supported:number; total:number; off_diagonal_supported:number; off_diagonal_total:number; scale_max:number };
};
const fmt = (n: number|null, digits=5) => n === null ? 'f-' : n.toFixed(digits);

export default function H1AttentionDiagnostics({ result, rawScale }: { result: AnalysisResult; rawScale: number }) {
  const diagnostics=result.views.diagnostics as Diagnostics|undefined;
  const [self, setSelf]=useState(true);
  if (!diagnostics) return <p className="text-sm">Rerun Phase 2 to generate support and positional diagnostics.</p>;
  const {genre_statistics: stats, movie_matrix: matrix, distance}=diagnostics;
  const records=stats.map(s => self ? s : {...s,...s.nonself});
  const top=records.filter(s => s.mean !== null).sort((a,b) => b.mean!-a.mean!).slice(0,10);
  const missing=records.filter(s => !s.count);
  const positions=matrix.movies.map((_,i)=>i);
  const groups=matrix.groups.filter(g=>g.count);
  const shapes: Partial<Layout>['shapes']=groups.slice(1).flatMap(g => [
    {type:'line' as const,x0:g.start-.5,x1:g.start-.5,y0:-.5,y1:positions.length-.5,line:{color:'#64748b',width:1}},
    {type:'line' as const,y0:g.start-.5,y1:g.start-.5,x0:-.5,x1:positions.length-.5,line:{color:'#64748b',width:1}},
  ]);
  const ticks=groups.map(g=>g.start+(g.count-1)/2), names=groups.map(g=>g.genre);
  const text=matrix.movies.map((q,i)=>matrix.movies.map((k,j)=>`Query: ${q.title} (${q.genres.join(', ')})<br>Key: ${k.title} (${k.genres.join(', ')})<br>${matrix.counts[i][j]} occurrences · ${matrix.users[i][j]} users`));
  return <section className="space-y-4 border-t pt-5">
    <h3 className="font-bold">Attention audit - full run sample</h3>
    <p className="text-sm text-slate-600">These diagnostics use all users in this run, independently of the inspection filters above. No missing pairs are filled in.</p>
    <PlotFrame title="Individual movies grouped by genre" height={560}
      note={`Observed movie pairs only: ${matrix.supported}/${matrix.total} cells; excluding the diagonal, ${matrix.off_diagonal_supported}/${matrix.off_diagonal_total}. Gray cells have no observations; valid zero attention uses the low end of Viridis. Probability color scale 0–${rawScale}, shared with the raw genre matrix above. Higher values saturate; exact values remain in tooltips.`}
      data={positions.length ? [{type:'heatmap',x:positions,y:positions,z:matrix.mean,text,hoverongaps:false,colorscale:'Viridis',zmin:0,zmax:rawScale,hovertemplate:'%{text}<br>Mean attention: %{z:.5f}<extra></extra>'} as Data] : []}
      layout={{plot_bgcolor:'#e2e8f0',shapes,margin:{l:115,b:100},xaxis:{title:{text:'Key movie (grouped, not chronological)'},tickvals:ticks,ticktext:names},yaxis:{title:{text:'Query movie'},tickvals:ticks,ticktext:names,autorange:'reversed'}}} />
    <p className="text-xs text-slate-500">Up to 12 observed movies per group, sampled with the run seed. A multi-genre movie appears once, in its first matching group in this order: Sci-Fi, Romance, Animation, Horror. All its genres remain in tooltips. Self-pairs are included. Grouping changes display order only; attention was computed in actual chronological contexts. Sparse coverage cannot establish reference-like blocks.</p>
    <div className="flex flex-wrap gap-3 text-xs">{matrix.groups.map(g=><span key={g.genre}>{g.genre}: {g.count} selected / {g.available} available</span>)}</div>
    <PlotFrame title="Attention by exact sequence distance" note="All non-self causal pairs, without display subsampling. Each curve compares the same distance; differences in users and query positions can still confound it." data={[false,true].map(overlap=>{
      const points=distance.curves.filter(r=>r.overlap===overlap);
      return {type:'scatter',mode:'lines+markers',name:overlap?'Overlapping genres':'Disjoint genres',x:points.map(r=>r.distance),y:points.map(r=>r.mean),text:points.map(r=>`${r.count} pairs`),connectgaps:false,hovertemplate:'Distance %{x}<br>Mean %{y:.5f}<br>%{text}<extra></extra>'} as Data;
    })} layout={{xaxis:{title:{text:'Query position − key position'}},yaxis:{title:{text:'Mean raw attention'}}}} />
    <p className="rounded border bg-white p-4 text-sm">Matched within the same user and exact distance: overlap − disjoint mean = <strong>{fmt(distance.summary.gap)}</strong> across {distance.summary.matched_strata} supported strata in {distance.summary.matched_users} users. Each stratum is weighted by the smaller group count. Equal-user mean difference: {fmt(distance.summary.equal_user_gap)}; {distance.summary.positive_users} users have positive differences. Self-pairs are excluded. Unmatched strata are omitted; this is descriptive and still does not match exact query positions.</p>
    <label className="text-sm"><input type="checkbox" checked={self} onChange={e=>setSelf(e.target.checked)} /> Include self-attention in the statistics table</label>
    <h4 className="text-sm font-bold">Ten highest mean genre-pair attentions</h4>
    <p className="text-xs">Mean, median, population standard deviation, and distance use fractional weights. Pair counts are integer counts, not independent observations. User concentration is the largest user’s fraction of observation mass.</p>
    <div className="overflow-auto rounded border bg-white"><table className="w-full text-left text-xs"><thead><tr>{['Query → key','Mean','Median','SD','Pairs','Users','Mass','Mean distance','Largest user'].map(s=><th className="p-2" key={s}>{s}</th>)}</tr></thead><tbody>{top.map(s=><tr key={`${s.query}-${s.key}`} className="border-t"><td className="p-2">{s.query} → {s.key}</td><td>{fmt(s.mean)}</td><td>{fmt(s.median)}</td><td>{fmt(s.std)}</td><td>{s.count}</td><td>{s.users}</td><td>{s.mass.toFixed(2)}</td><td>{fmt(s.mean_distance,2)}</td><td>{s.max_user_fraction===null?'-':`${(s.max_user_fraction*100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>
    <details className="text-xs"><summary>{missing.length} unsupported genre cells - reasons and full statistics</summary><p className="my-2">There is no minimum-count filter. Unsupported cells have no valid observations after sample, window, causal, and self-pair selection. Metadata is verified before computation. JSON uses null for missing numerical values (NaN internally).</p><div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead><tr><th>Query → key</th><th>Mean</th><th>Pairs</th><th>Users</th><th>Status</th></tr></thead><tbody>{records.map(r=><tr key={`${r.query}-${r.key}`}><td>{r.query} → {r.key}</td><td>{fmt(r.mean)}</td><td>{r.count}</td><td>{r.users}</td><td>{r.count?'Observed':r.missing_reason ?? 'No non-self observations'}</td></tr>)}</tbody></table></div></details>
  </section>;
}
