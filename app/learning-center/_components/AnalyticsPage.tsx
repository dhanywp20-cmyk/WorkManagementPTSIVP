'use client';

import { useState, useEffect } from 'react';
import { supabase, SearchInput } from './shared';

function DonutChart({ segments, size = 72, strokeWidth = 11, label = '' }: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] text-slate-300 font-bold">—</span>
    </div>
  );
  let cumBefore = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circ;
          const offset = -(cumBefore / total) * circ;
          cumBefore += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-slate-700">{label}</span>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase
        .from('lc_quiz_attempts')
        .select('user_id, score, passed, started_at, submitted_at, users(full_name)')
        .eq('is_submitted', true);

      if (a) {
        const byUser: Record<string, { name: string; scores: number[]; passed: number }> = {};
        a.forEach((att: any) => {
          if (!byUser[att.user_id]) byUser[att.user_id] = { name: att.users?.full_name ?? '-', scores: [], passed: 0 };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (att.passed) byUser[att.user_id].passed++;
        });
        setTopUsers(Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          total: v.scores.length, passed: v.passed,
        })).sort((a, b) => b.avg - a.avg).slice(0, 20));
      }

      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const stats = await Promise.all(ss.map(async (s: any) => {
          const { data: att } = await supabase
            .from('lc_quiz_attempts')
            .select('score, passed, started_at, submitted_at')
            .eq('quiz_session_id', s.id).eq('is_submitted', true);
          if (!att?.length) return null;
          const avg = att.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / att.length;
          const passed = att.filter((a: any) => a.passed).length;
          const durations = att
            .filter((a: any) => a.started_at && a.submitted_at)
            .map((a: any) => (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000);
          const avgMin = durations.length ? durations.reduce((s: number, d: number) => s + d, 0) / durations.length : null;
          return {
            id: s.id, name: s.session_name,
            total: att.length, avg, passed, failed: att.length - passed,
            avgMin,
            scoreGood: att.filter((a: any) => (a.score ?? 0) >= 80).length,
            scoreMid: att.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length,
            scoreLow: att.filter((a: any) => (a.score ?? 0) < 60).length,
          };
        }));
        setSessionStats(stats.filter(Boolean));
      }
      setLoading(false);
    };
    load();
  }, []);

  const filteredUsers = search
    ? topUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : topUsers;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📈 Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performa team & statistik quiz</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama..." />
      </div>

      <div className="p-8 space-y-10">

        {sessionStats.length > 0 && (
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Statistik Per Sesi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sessionStats.map((s: any) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
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
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lulus</span>
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
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nilai</span>
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
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Waktu</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Peserta</span>
                        <span className="font-bold text-slate-700">{s.total}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Avg</span>
                        <span className={`font-bold ${s.avg >= 80 ? 'text-emerald-600' : s.avg >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</span>
                      </div>
                      {s.avgMin !== null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Waktu</span>
                          <span className="font-bold text-violet-600">{s.avgMin.toFixed(0)} mnt</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{s.passed} lulus</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{s.failed} gagal</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {s.scoreGood}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {s.scoreMid}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {s.scoreLow}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Top Performers</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Score</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, i) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-center text-sm font-black text-slate-300">{i + 1}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-5 py-3.5 text-center text-slate-500 text-xs font-semibold">{u.total}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <DonutChart
                          segments={[
                            { value: u.avg, color: u.avg >= 80 ? '#10b981' : u.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                            { value: 100 - u.avg, color: '#f1f5f9' },
                          ]}
                          size={36} strokeWidth={6}
                          label={u.avg.toFixed(0)}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.passed > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                        {u.passed}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      {loading ? 'Memuat data...' : search ? 'Tidak ada hasil' : 'Belum ada data'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
