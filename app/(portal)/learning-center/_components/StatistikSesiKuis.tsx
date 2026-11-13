'use client';

import { DonutChart } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { SectionHeader } from './RingkasanKuis';
import type { StatSesi } from './tipe-dasbor';

export interface StatistikSesiKuisProps {
  sessionStats: StatSesi[];
}

export function StatistikSesiKuis({
  sessionStats,
}: StatistikSesiKuisProps) {
  return (
    <>{sessionStats.length > 0 && (() => {
      const totalPeserta = sessionStats.reduce((n: number, s) => n + s.total, 0);
      const totalPassed  = sessionStats.reduce((n: number, s) => n + s.passed, 0);
      const totalFailed  = sessionStats.reduce((n: number, s) => n + s.failed, 0);
      const scoreGood    = sessionStats.reduce((n: number, s) => n + s.scoreGood, 0);
      const scoreMid     = sessionStats.reduce((n: number, s) => n + s.scoreMid, 0);
      const scoreLow     = sessionStats.reduce((n: number, s) => n + s.scoreLow, 0);
      const avgScore     = totalPeserta > 0
        ? sessionStats.reduce((n: number, s) => n + s.avg * s.total, 0) / totalPeserta : 0;
      const sesiDenganWaktu = sessionStats.filter((s) => s.avgMin !== null);
      const avgMin = sesiDenganWaktu.length
        ? sesiDenganWaktu.reduce((n: number, s) => n + (s.avgMin ?? 0), 0) / sesiDenganWaktu.length : null;
      const sesiUrut = [...sessionStats].sort((a, b) => a.avg - b.avg);
    
      return (
        <section>
          <SectionHeader><IkonTeks nama="📈" />Statistik Per Sesi Quiz</SectionHeader>
          <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-wrap items-start gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <DonutChart size={92} strokeWidth={13}
                  segments={[{ value: totalPassed, color: '#10b981' }, { value: totalFailed, color: '#f43f5e' }]}
                  label={totalPeserta > 0 ? `${Math.round(totalPassed / totalPeserta * 100)}%` : '-'}
                />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lulus vs Gagal</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{totalPassed} lulus</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{totalFailed} gagal</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <DonutChart size={92} strokeWidth={13}
                  segments={[
                    { value: scoreGood, color: '#3b82f6' },
                    { value: scoreMid, color: '#f59e0b' },
                    { value: scoreLow, color: '#ef4444' },
                  ]}
                  label={avgScore.toFixed(0)}
                />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sebaran Nilai</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {scoreGood}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {scoreMid}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {scoreLow}</span>
                </div>
              </div>
              {avgMin !== null && (
                <div className="flex flex-col items-center gap-1.5">
                  <DonutChart size={92} strokeWidth={13}
                    segments={[
                      { value: Math.min(avgMin, 60), color: '#8b5cf6' },
                      { value: Math.max(60 - Math.min(avgMin, 60), 0), color: '#ede9fe' },
                    ]}
                    label={`${Math.round(avgMin)}m`}
                  />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata Waktu</span>
                </div>
              )}
            </div>
            <div className="mt-5 pt-1 overflow-x-auto">
              <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sesi</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Peserta</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Avg</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {sesiUrut.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-semibold text-slate-700 truncate max-w-[240px]">{s.name}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{s.total}</td>
                      <td className={`px-3 py-2 text-center font-bold ${s.avg >= 80 ? 'text-emerald-700' : s.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{s.passed}/{s.total}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{s.avgMin !== null ? `${s.avgMin.toFixed(0)} mnt` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-500 pt-2">Diurutkan dari nilai rata-rata terendah</p>
            </div>
          </div>
        </section>
      );
    })()}</>
  );
}
