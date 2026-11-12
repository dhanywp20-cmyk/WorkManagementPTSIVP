'use client';

import React from 'react';
import { TeamSwitch, TEAM_FILTER_CONFIG, type TeamFilter } from './team-filter';
import { SearchInput } from './shared';
import { DonutChart } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface PapanPerformaProps {
  nationalAvg: number | null;
  activeTeam: TeamFilter;
  performerDivisionFilter: string;
  divisionStats: any[];
  setActiveTeam: React.Dispatch<React.SetStateAction<TeamFilter>>;
  setPerformerDivisionFilter: React.Dispatch<React.SetStateAction<string>>;
  searchPerformer: string;
  setSearchPerformer: React.Dispatch<React.SetStateAction<string>>;
  filteredPerformers: any[];
  setSelectedUser: React.Dispatch<React.SetStateAction<{ uid: string; name: string; } | null>>;
  loadingAnalytics: boolean;
}

export function PapanPerforma({
  nationalAvg, activeTeam, performerDivisionFilter, divisionStats, setActiveTeam, setPerformerDivisionFilter, searchPerformer, setSearchPerformer,
  filteredPerformers, setSelectedUser, loadingAnalytics,
}: PapanPerformaProps) {
  return (
    <div className="min-w-0">
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600 whitespace-nowrap"
              title="Diurutkan dari skor rata-rata tertinggi. Jika skor sama, rata-rata waktu pengerjaan tercepat menang.">
              <IkonTeks nama="🏆" />Top Performers
            </span>
            {nationalAvg !== null && (
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                <IkonTeks nama="🌏" />Nasional: <span className="font-bold text-slate-800">{nationalAvg.toFixed(1)}</span>
                {activeTeam === 'Sales' && performerDivisionFilter && (() => {
                  const d = divisionStats.find(d => d.name === performerDivisionFilter);
                  if (!d) return null;
                  const gap = d.avg - nationalAvg;
                  return (
                    <span className={`ml-1.5 font-bold ${gap >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      · {performerDivisionFilter} {d.avg.toFixed(1)} ({gap >= 0 ? '▲' : '▼'}{Math.abs(gap).toFixed(1)})
                    </span>
                  );
                })()}
              </span>
            )}
          </div>
    
          <div className="flex items-center gap-2 flex-wrap">
            <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
            <select aria-label="Filter divisi" value={performerDivisionFilter} onChange={e => setPerformerDivisionFilter(e.target.value)}
              disabled={activeTeam !== 'Sales'}
              aria-hidden={activeTeam !== 'Sales'}
              className={`text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-hidden focus:border-indigo-400 bg-white font-semibold text-slate-600 ${activeTeam === 'Sales' && divisionStats.length > 0 ? '' : 'invisible pointer-events-none'}`}>
              <option value="">Semua Divisi</option>
              {divisionStats.filter(d => d.source === 'division').map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <SearchInput value={searchPerformer} onChange={setSearchPerformer} placeholder="Cari nama..." />
          </div>
        </div>
    
        <div className="overflow-x-auto overflow-y-auto max-h-[440px]">
        <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
          <thead className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-8">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Score</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPerformers.map((u, i) => (
              <tr key={u.uid}
                className="stagger-item hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                onClick={() => setSelectedUser({ uid: u.uid, name: u.name })}>
                <td className="px-4 py-3 text-center text-sm font-black text-slate-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors text-sm">{u.name}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-indigo-400 font-semibold"><Ikon nama="👁" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                    {u.consistency !== null && u.consistency > 40 && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><IkonTeks nama="⚡" />Inkonsisten</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-slate-500 text-xs font-semibold">{u.total}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    <DonutChart
                      segments={[
                        { value: u.avg, color: u.avg >= 80 ? '#10b981' : u.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                        { value: 100 - u.avg, color: '#f1f5f9' },
                      ]}
                      size={34} strokeWidth={5} label={u.avg.toFixed(0)}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.passed > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    {u.passed}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {u.tabSw > 0 && (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {u.tabSw}×</span>
                    )}
                    {u.fastCount > 0 && (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /> {u.fastCount}×</span>
                    )}
                    {u.tabSw === 0 && u.fastCount === 0 && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {filteredPerformers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500 text-sm">
                {loadingAnalytics ? 'Memuat data...' : searchPerformer ? 'Tidak ada hasil' : `Belum ada data untuk ${TEAM_FILTER_CONFIG[activeTeam].label}`}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="⚠" />N×</span>
            Pindah tab
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="🚨" />N×</span>
            Submit &lt;5det/soal
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="⚡" />Inkonsisten</span>
            Nilai selisih &gt;40pt
          </span>
        </div>
      </div>
    </div>
  );
}
