'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Question, QuizAttempt, DIFF_COLOR, fmtDate, ScoreBadge, SearchInput, BtnView } from './shared';

function UserAnswerReview({ user, onBack, isAdminView }: { user: User; onBack: () => void; isAdminView: boolean }) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [answerDetails, setAnswerDetails] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setAttempts(data ?? []));
  }, [user.id]);

  const handleViewDetail = async (attempt: any) => {
    setSelectedAttempt(attempt);
    setLoadingDetail(true);
    const questionIds: string[] = attempt.lc_quiz_sessions?.question_ids ?? [];
    const [{ data: ans }, { data: qs }] = await Promise.all([
      supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id),
      questionIds.length > 0
        ? supabase.from('lc_questions').select('*').in('id', questionIds)
        : Promise.resolve({ data: [] }),
    ]);
    const orderedQs = questionIds.map((id: string) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean) as Question[];
    setQuestions(orderedQs);
    setAnswerDetails(ans ?? []);
    setLoadingDetail(false);
  };

  const getAnswerFor = (questionId: string) => answerDetails.find(a => a.question_id === questionId);

  if (selectedAttempt) {
    return (
      <div>
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
          style={{ background: '#ffffff' }}>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">📋 Review Jawaban — {user.full_name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{selectedAttempt.lc_quiz_sessions?.session_name}</p>
          </div>
          <button onClick={() => setSelectedAttempt(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">← Kembali</button>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Skor', value: selectedAttempt.score?.toFixed(0) ?? '—', color: (selectedAttempt.score ?? 0) >= (selectedAttempt.lc_quiz_sessions?.passing_grade ?? 70) ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
              { label: 'Benar', value: `${selectedAttempt.total_correct}/${selectedAttempt.total_questions}`, color: 'from-blue-500 to-blue-600' },
              { label: 'Status', value: selectedAttempt.passed ? 'LULUS' : 'TIDAK LULUS', color: selectedAttempt.passed ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
              { label: 'Waktu', value: selectedAttempt.time_taken_sec ? `${Math.floor(selectedAttempt.time_taken_sec/60)}m ${selectedAttempt.time_taken_sec%60}s` : '—', color: 'from-indigo-500 to-indigo-600' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white shadow-lg text-center`}>
                <div className="text-2xl font-black">{c.value}</div>
                <div className="text-white/80 text-xs font-medium mt-1">{c.label}</div>
              </div>
            ))}
          </div>
          {loadingDetail ? (
            <div className="text-center py-10 text-slate-400">Memuat detail jawaban...</div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const ans = getAnswerFor(q.id);
                const userAnswer = ans?.answer ?? null;
                const isCorrect = userAnswer === q.correct_answer;
                const notAnswered = !userAnswer;
                return (
                  <div key={q.id}
                    className={`rounded-2xl border-2 p-5 ${notAnswered ? 'border-slate-200 bg-white' : isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1} · <span className={`${DIFF_COLOR[q.difficulty].split(' ')[1]}`}>{q.difficulty}</span></p>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-10">
                      {(['A','B','C','D'] as const).map(opt => {
                        const optVal = (q as any)[`option_${opt.toLowerCase()}`];
                        const isUserChoice = userAnswer === opt;
                        const isCorrectOpt = q.correct_answer === opt;
                        let style = 'bg-white border-slate-200 text-slate-600';
                        if (isCorrectOpt) style = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold';
                        if (isUserChoice && !isCorrectOpt) style = 'bg-rose-50 border-rose-400 text-rose-800 font-bold';
                        return (
                          <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs transition-all ${style}`}>
                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
                            <span className="flex-1">{optVal}</span>
                            {isCorrectOpt && <span className="text-emerald-600 font-bold">✓ Benar</span>}
                            {isUserChoice && !isCorrectOpt && <span className="text-rose-600 font-bold">← Pilihan</span>}
                          </div>
                        );
                      })}
                    </div>
                    {notAnswered && <p className="ml-10 mt-2 text-xs text-slate-400 italic">Tidak dijawab</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">{isAdminView ? `👁️ Jawaban — ${user.full_name}` : '📋 Lihat Jawaban Saya'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pilih quiz untuk melihat detail jawaban</p>
        </div>
        <button onClick={onBack} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">← Kembali</button>
      </div>
      <div className="p-8 space-y-4">
        {attempts.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3">📋</div>
              <p className="font-semibold text-slate-700">Belum ada quiz yang diselesaikan</p>
              <p className="text-sm mt-1 text-slate-500">Anggota ini belum mengerjakan quiz apapun</p>
            </div>
          </div>
        )}
        {attempts.map(a => (
          <div key={a.id} className="rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-5"
            style={{ background: '#ffffff' }}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
              {a.score?.toFixed(0) ?? '—'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
              <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                <span>📅 {a.submitted_at ? fmtDate(a.submitted_at) : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
              </span>
              <BtnView onClick={() => handleViewDetail(a)}>Detail Jawaban</BtnView>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { UserAnswerReview };

export function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [{ data: u }, { data: a }] = await Promise.all([
      supabase.from('users').select('id, full_name, username, role, jabatan, sales_division').order('full_name'),
      supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
    ]);
    setUsers((u ?? []).filter((u: any) => u.role !== 'guest'));
    setAttempts(a ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (selectedUser) {
    return <UserAnswerReview user={selectedUser} onBack={() => setSelectedUser(null)} isAdminView={true} />;
  }

  const filtered = search
    ? users.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.role ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">👥 Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar anggota team & partisipasi quiz</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari anggota..." />
      </div>
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ background: '#ffffff' }}>
          <table className="w-full text-sm table-zebra">
            <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Role</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz Diikuti</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Rata-rata Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Pass Rate</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">{search ? 'Tidak ada anggota yang cocok' : 'Belum ada data'}</td></tr>
              )}
              {filtered.map(u => {
                const ua = attempts.filter((a: any) => a.user_id === u.id);
                const avg = ua.length ? ua.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / ua.length : null;
                const passed = ua.filter((a: any) => a.passed).length;
                return (
                  <tr key={u.id} className="stagger-item hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{ua.length}</td>
                    <td className="px-5 py-3.5 text-center">
                      {avg !== null ? <span className={`font-bold ${avg >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>{avg.toFixed(1)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length ? <span className="text-xs font-bold text-indigo-600">{Math.round(passed/ua.length*100)}%</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length > 0 && (
                        <BtnView onClick={() => setSelectedUser(u)}>Lihat Jawaban</BtnView>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
