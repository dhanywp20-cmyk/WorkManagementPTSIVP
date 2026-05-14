'use client';

import { useState, useEffect } from 'react';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';

export function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ materials: 0, activeTeam: 0, sessions: 0, attempts: 0 });
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const [mat, ses, att] = await Promise.all([
        supabase.from('lc_materials').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }),
      ]);

      // Total team yang pernah mengikuti minimal 1 quiz
      const { data: teamData } = await supabase
        .from('lc_quiz_attempts')
        .select('user_id')
        .eq('is_submitted', true);
      const uniqueTeam = new Set((teamData ?? []).map((a: any) => a.user_id)).size;

      setStats({
        materials: mat.count ?? 0,
        activeTeam: uniqueTeam,
        sessions: ses.count ?? 0,
        attempts: att.count ?? 0,
      });

      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, users(full_name), lc_quiz_sessions(session_name, passing_grade)')
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false })
        .limit(50);
      setRecentAttempts(data ?? []);
    };
    load();
  }, []);

  const cards = [
    { label: 'Total Materi', value: stats.materials, icon: '📚', color: 'from-blue-500 to-blue-600' },
    { label: 'Active Team', value: stats.activeTeam, icon: '👥', color: 'from-violet-500 to-violet-600' },
    { label: 'Sesi Aktif', value: stats.sessions, icon: '🎯', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Total Attempt', value: stats.attempts, icon: '📝', color: 'from-amber-500 to-amber-600' },
  ];

  const filtered = recentAttempts.filter(a =>
    !search ||
    (a.users?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Selamat datang, {user.full_name}</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari aktivitas..." />
      </div>
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-4 gap-5">
          {cards.map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          style={{ background: '#ffffff' }}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Aktivitas Terbaru</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">
                {search ? 'Tidak ada hasil yang cocok' : 'Belum ada aktivitas quiz'}
              </div>
            )}
            {filtered.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                  {a.users?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.users?.full_name ?? '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.session_name ?? '-'}</p>
                </div>
                <ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} />
                <span className="text-xs text-slate-400 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
