'use client';

import { DonutChart } from '@/components/shared';

export interface KartuSesiKuisProps {
  sessionStats: any[];
}

export function KartuSesiKuis({
  sessionStats,
}: KartuSesiKuisProps) {
  return (
    <>{sessionStats.length > 0 && (
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs">Statistik Per Sesi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessionStats.map((s: any) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <p className="text-sm font-bold text-slate-800 mb-4 leading-snug line-clamp-2">{s.name}</p>
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1">
                  <DonutChart
                    segments={[
                      { value: s.passed, color: '#10b981' },
                      { value: s.failed, color: '#f43f5e' },
                    ]}
                    size={68} strokeWidth={10}
                    label={s.total > 0 ? `${Math.round(s.passed / s.total * 100)}%` : '-'}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lulus</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <DonutChart
                    segments={[
                      { value: s.scoreGood, color: '#3b82f6' },
                      { value: s.scoreMid, color: '#f59e0b' },
                      { value: s.scoreLow, color: '#ef4444' },
                    ]}
                    size={68} strokeWidth={10}
                    label={s.avg.toFixed(0)}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nilai</span>
                </div>
                {s.avgMin !== null && (
                  <div className="flex flex-col items-center gap-1">
                    <DonutChart
                      segments={[
                        { value: Math.min(s.avgMin, 60), color: '#8b5cf6' },
                        { value: Math.max(60 - Math.min(s.avgMin, 60), 0), color: '#ede9fe' },
                      ]}
                      size={68} strokeWidth={10}
                      label={`${Math.round(s.avgMin)}m`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Waktu</span>
                  </div>
                )}
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Peserta</span>
                    <span className="font-bold text-slate-700">{s.total}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Avg</span>
                    <span className={`font-bold ${s.avg >= 80 ? 'text-emerald-700' : s.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</span>
                  </div>
                  {s.avgMin !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Waktu</span>
                      <span className="font-bold text-violet-600">{s.avgMin.toFixed(0)} mnt</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{s.passed} lulus</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{s.failed} gagal</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {s.scoreGood}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {s.scoreMid}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {s.scoreLow}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}</>
  );
}
