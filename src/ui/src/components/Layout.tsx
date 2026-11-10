import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import { hypotheses, hypothesisGroups } from '../content/hypotheses';
import type { AppStatus } from '../types/api';

export type LayoutContext = { status: AppStatus | null; error: string | null; refresh: () => Promise<void> };

export default function Layout() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setStatus(await api.status()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Backend unavailable'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-7">
        <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
          SASRec <span className="font-normal text-slate-500">/ Visual Analytics</span>
        </Link>
        {error && <span role="alert" className="text-xs text-red-700">API unavailable · <button type="button" onClick={() => void refresh()} className="underline">Retry</button></span>}
      </div>
      <nav aria-label="Main navigation" className="flex w-full gap-1 overflow-x-auto px-4 pb-2 md:px-7">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}>Overview</NavLink>
        {hypothesisGroups.map(group => <div key={group.id} className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-3" aria-label={`${group.label} investigations`}>
          <span className="whitespace-nowrap px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.label}</span>
          {hypotheses.filter(hypothesis => hypothesis.group === group.id).map(hypothesis => <NavLink
            to={`/hypotheses/${hypothesis.id}`} key={hypothesis.id}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
            H{Number(hypothesis.accent)} <span className="hidden lg:inline">· {hypothesis.short}</span>
          </NavLink>)}
        </div>)}
      </nav>
    </header>
    <main className="w-full px-4 py-4 md:px-6 md:py-6 2xl:px-8">
      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <Outlet context={{ status, error, refresh } satisfies LayoutContext} />
    </main>
  </div>;
}
