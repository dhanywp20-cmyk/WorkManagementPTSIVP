'use client';

import { useState, useEffect } from 'react';
import { supabase, User, QuizSession, fmtDate, ScoreBadge, SearchInput } from './shared';
import { UserAnswerReview } from './TeamPage';

export function ReportPage({ currentUser }: { currentUser: User }) {
  const [data, setData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [viewingUser, setViewingUser] = useState<{ user: User; attemptId: string } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false })
      .then(({ data: s }: { data: QuizSession[] | null }) => setSessions(s ?? []));
  }, []);

  useEffect(() => {
    if (!selectedSession) { setData([]); return; }
    supabase.from('lc_quiz_attempts')
      .select('*, users(id, full_name, username, jabatan, role)')
      .eq('quiz_session_id', selectedSession).eq('is_submitted', true)
      .order('score', { ascending: false })
      .then(({ data: a }: { data: any[] | null }) => setData(a ?? []));
  }, [selectedSession]);

  const session = sessions.find(s => s.id === selectedSession);

  if (viewingUser) {
    return <UserAnswerReview user={viewingUser.user} onBack={() => setViewingUser(null)} isAdminView={true} />;
  }

  const filtered = search
    ? data.filter(a =>
        (a.users?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.users?.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : data;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/30 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📋 Laporan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Hasil quiz per sesi</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari peserta..." />
      </div>
      <div className="p-8 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Pilih Sesi Quiz</label>
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white min-w-[320px]">
            <option value="">-- Pilih Sesi --</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
          </select>
        </div>

        {data.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Peserta', value: data.length },
                { label: 'Rata-rata', value: (data.reduce((s: number, a: any) => s+(a.score??0),0)/data.length).toFixed(1) },
                { label: 'Lulus', value: data.filter((a: any) => a.passed).length },
                { label: 'Pass Rate', value: `${Math.round(data.filter((a: any) => a.passed).length/data.length*100)}%` },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-800">{c.value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Peserta</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Waktu</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada peserta yang cocok</td></tr>
                  )}
                  {filtered.map((a: any, i: number) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mx-auto ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{a.users?.full_name}</td>
                      <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                      <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={session?.passing_grade ?? 70} /></td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.time_taken_sec ? `${Math.floor(a.time_taken_sec/60)}m ${a.time_taken_sec%60}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {a.users && (
                          <button onClick={() => setViewingUser({ user: a.users as User, attemptId: a.id })}
                            className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                            👁️ Jawaban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedSession && data.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold">Belum ada peserta yang submit</p>
          </div>
        )}
      </div>
    </div>
  );
}
