'use client';

import { IkonTeks } from '@/components/shared/Ikon';
import { SectionHeader } from './RingkasanKuis';

export interface StatistikDivisiProps {
  divisionStats: any[];
  nationalAvg: number | null;
}

export function StatistikDivisi({
  divisionStats, nationalAvg,
}: StatistikDivisiProps) {
  return (
    <>{divisionStats.length > 0 && (
      <section>
        <SectionHeader><IkonTeks nama="🏢" />Ranking Per Divisi / Jabatan</SectionHeader>
        <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto">
          <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Sales Division / Jabatan</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Attempt</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">vs Nasional</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {divisionStats.map((d, i) => (
                <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-center text-sm font-black text-slate-500">{i + 1}</td>
                  <td className="px-5 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{d.name}</span>
                        {d.source === 'division' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-wide">Sales Div</span>
                        )}
                        {d.source === 'jabatan' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">Jabatan</span>
                        )}
                      </div>
                      {d.source === 'division' && d.jabatan && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[220px]">{d.jabatan}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center text-xs text-slate-500 font-semibold">{d.total}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full"
                          style={{ width: `${d.avg}%`, background: d.avg >= 80 ? '#10b981' : d.avg >= 60 ? '#f59e0b' : '#f43f5e' }} />
                      </div>
                      <span className={`text-xs font-bold w-8 text-right ${d.avg >= 80 ? 'text-emerald-700' : d.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>
                        {d.avg.toFixed(0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {nationalAvg !== null ? (() => {
                      const gap = d.avg - nationalAvg;
                      return (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gap >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {gap >= 0 ? '▲' : '▼'} {Math.abs(gap).toFixed(1)}
                        </span>
                      );
                    })() : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      d.passRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : d.passRate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>{d.passRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )}</>
  );
}
