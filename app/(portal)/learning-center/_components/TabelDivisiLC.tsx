'use client';

import { DonutChart } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface TabelDivisiLCProps {
  divisionStats: any[];
  nationalAvg: number | null;
}

export function TabelDivisiLC({
  divisionStats, nationalAvg,
}: TabelDivisiLCProps) {
  return (
    <>{divisionStats.length > 0 && (
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-1 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs"><IkonTeks nama="🏢" />Top Performers — Sales Division</h3>
        <p className="text-xs text-slate-500 mb-4 ml-1">Ranking performa per divisi penjualan, diurutkan berdasarkan rata-rata nilai</p>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto">
          <table className="w-full text-sm table-zebra">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Division</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">User</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">vs Nasional</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Pass Rate</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Distribusi Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {divisionStats.map((d: any, i: number) => {
                const passRate = d.total > 0 ? Math.round(d.passed / d.total * 100) : 0;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                return (
                  <tr key={d.div} className="hover:bg-orange-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-center text-sm font-black text-slate-500">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-sm shrink-0"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{d.div}</p>
                          {medal && <p className="text-[11px] text-slate-500">{medal} Top {i + 1}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-600">{d.users}</td>
                    <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-600">{d.total}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <DonutChart
                          segments={[
                            { value: d.avg, color: d.avg >= 80 ? '#10b981' : d.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                            { value: 100 - d.avg, color: '#f1f5f9' },
                          ]}
                          size={40} strokeWidth={7}
                          label={d.avg.toFixed(0)}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {nationalAvg !== null ? (() => {
                        const gap = d.avg - nationalAvg;
                        const up = gap >= 0;
                        return (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${up ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {up ? '▲' : '▼'} {Math.abs(gap).toFixed(1)}
                          </span>
                        );
                      })() : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-sm font-bold text-emerald-700">{d.passed}</span>
                      <span className="text-xs text-slate-500"> / {d.total}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${passRate >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : passRate >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                        {passRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-slate-500">≥80: <strong>{d.scoreGood}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-slate-500">60–79: <strong>{d.scoreMid}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                          <span className="text-slate-500">&lt;60: <strong>{d.scoreLow}</strong></span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    )}</>
  );
}
