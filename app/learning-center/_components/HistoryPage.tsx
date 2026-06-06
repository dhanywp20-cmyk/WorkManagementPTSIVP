'use client';

import { useState, useEffect } from 'react';
import { supabase, User, fmtDate, SearchInput, BtnView } from './shared';
import { UserAnswerReview } from './TeamPage';

export function HistoryPage({ user }: { user: User }) {
  const [history, setHistory] = useState<any[]>([]);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setHistory(data ?? []));
  }, [user.id]);

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} />;
  }

  const filtered = search
    ? history.filter(a =>
        (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.lc_quiz_sessions?.materi_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : history;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">🕐 Riwayat Quiz</h1>
          <p className="text-sm text-slate-500 mt-0.5">Semua quiz yang pernah kamu ikuti</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi atau materi..." />
      </div>
      <div className="p-8">
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="text-center px-10 py-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                <div className="text-5xl mb-3">🕐</div>
                <p className="font-semibold text-slate-700">{search ? 'Tidak ada hasil' : 'Belum ada riwayat quiz'}</p>
                {!search && <p className="text-sm mt-1 text-slate-500">Selesaikan quiz untuk melihat riwayat</p>}
              </div>
            </div>
          )}
          {filtered.map(a => (
            <div key={a.id} className="stagger-item rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-5"
              style={{ background: '#ffffff' }}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
                {a.score?.toFixed(0) ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
                <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                  <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                  <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                  {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-3">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                    {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1.5">{a.submitted_at ? fmtDate(a.submitted_at) : ''}</p>
                </div>
                <BtnView onClick={() => setViewingAttempt(a)}>Lihat Jawaban</BtnView>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
