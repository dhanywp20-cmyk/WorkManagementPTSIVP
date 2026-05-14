'use client';

import { useState, useEffect } from 'react';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';
import { UserAnswerReview } from './TeamPage';

export function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .then(({ data }: { data: any[] | null }) => setAttempts(data ?? []));
  }, [user.id]);

  const avg = attempts.length ? attempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / attempts.length : 0;
  const passed = attempts.filter((a: any) => a.passed).length;

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} />;
  }

  const filtered = search
    ? attempts.filter(a =>
        (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.lc_quiz_sessions?.materi_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : attempts;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">🏆 Nilai Saya</h1>
          <p className="text-sm text-slate-500 mt-0.5">Rekap performa quiz kamu</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi atau materi..." />
      </div>
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-5">
          {[
            { label: 'Quiz Diikuti', value: attempts.length, icon: '📝', color: 'from-blue-500 to-blue-600' },
            { label: 'Rata-rata Skor', value: avg.toFixed(1), icon: '📊', color: 'from-indigo-500 to-indigo-600' },
            { label: 'Total Lulus', value: passed, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ background: '#ffffff' }}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Rekap Nilai Per Quiz</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">
                  {search ? 'Tidak ada hasil' : 'Belum ada quiz yang diselesaikan'}
                </td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</td>
                  <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} /></td>
                  <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                      {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <button onClick={() => setViewingAttempt(a)}
                      className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                      📋 Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
