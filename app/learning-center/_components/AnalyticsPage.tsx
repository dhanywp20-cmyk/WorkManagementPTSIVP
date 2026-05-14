'use client';

import { useState, useEffect } from 'react';
import { supabase, SearchInput } from './shared';

export function AnalyticsPage() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase.from('lc_quiz_attempts').select('user_id, score, passed, users(full_name)').eq('is_submitted', true);
      if (a) {
        const byUser: Record<string, { name: string; scores: number[]; passed: number }> = {};
        a.forEach((att: any) => {
          if (!byUser[att.user_id]) byUser[att.user_id] = { name: att.users?.full_name ?? '-', scores: [], passed: 0 };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (att.passed) byUser[att.user_id].passed++;
        });
        const top = Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          total: v.scores.length, passed: v.passed,
        })).sort((a, b) => b.avg - a.avg).slice(0, 20);
        setTopUsers(top);
      }
      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const stats = await Promise.all(ss.map(async (s: any) => {
          const { data: att, count } = await supabase.from('lc_quiz_attempts')
            .select('score, passed', { count: 'exact' }).eq('quiz_session_id', s.id).eq('is_submitted', true);
          const avg = att?.length ? att.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / att.length : 0;
          const passed = att?.filter((a: any) => a.passed).length ?? 0;
          return { name: s.session_name, total: count ?? 0, avg, passed };
        }));
        setSessionStats(stats.filter((s: any) => s.total > 0));
      }
    };
    load();
  }, []);

  const filteredUsers = search
    ? topUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : topUsers;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/30 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📈 Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performa team & statistik quiz</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama..." />
      </div>
      <div className="p-8 space-y-8">
        <div>
          <h3 className="font-bold text-slate-800 mb-4">🏆 Top Performers</h3>
          <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
                <tr>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Avg Score</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Lulus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, i) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-center text-sm font-black text-slate-400">{i+1}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{u.total}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`font-black text-base ${u.avg >= 80 ? 'text-emerald-600' : u.avg >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{u.avg.toFixed(1)}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-indigo-600 font-bold">{u.passed}</td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-slate-400">{search ? 'Tidak ada hasil' : 'Belum ada data'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {sessionStats.length > 0 && (
          <div>
            <h3 className="font-bold text-slate-800 mb-4">📊 Statistik Per Sesi</h3>
            <div className="grid grid-cols-1 gap-3">
              {sessionStats.map(s => (
                <div key={s.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm truncate">{s.name}</span>
                    <div className="flex gap-3 text-xs flex-shrink-0">
                      <span className="text-slate-500">{s.total} peserta</span>
                      <span className="font-bold text-indigo-600">avg: {s.avg.toFixed(1)}</span>
                      <span className="font-bold text-emerald-600">{s.passed} lulus</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(s.avg, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
