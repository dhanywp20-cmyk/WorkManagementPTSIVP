'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, User, Question, QuizSession, QuizAttempt, SearchInput, AppDialog, DialogState } from './shared';

function QuizPlayer({ session, user, attempt, onDone }: {
  session: QuizSession; user: User; attempt: QuizAttempt; onDone: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; passed: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(session.timer_minutes ? session.timer_minutes * 60 : null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const tabSwitchesRef = useRef(0);
  const [showReview, setShowReview] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      if (!session.question_ids?.length) return;
      const { data } = await supabase.from('lc_questions').select('*').in('id', session.question_ids);
      const ordered = session.question_ids.map(id => data?.find((q: any) => q.id === id)).filter(Boolean) as Question[];
      setQuestions(ordered);
    };
    load();
    const loadAnswers = async () => {
      const { data } = await supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((a: any) => { map[a.question_id] = a.answer; });
      setSavedAnswers(map); setAnswers(map);
    };
    loadAnswers();
  }, []);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setInterval(() => setTimeLeft(p => (p ?? 1) - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, submitted]);

  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden && !submitted) {
        tabSwitchesRef.current += 1;
        const next = tabSwitchesRef.current;
        setTabSwitches(next);
        supabase.from('lc_quiz_attempts').update({ tab_switches: next }).eq('id', attempt.id);
        if (next >= 3) {
          setDialog({
            type: 'warning',
            title: 'Peringatan Tab Switch',
            message: `Kamu telah berpindah tab sebanyak ${next} kali. Data ini direkam oleh admin.`,
          });
        }
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [submitted]);

  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers(p => ({ ...p, [questionId]: answer }));
    const existing = savedAnswers[questionId];
    if (existing) {
      await supabase.from('lc_answers').update({ answer, answered_at: new Date().toISOString() })
        .eq('attempt_id', attempt.id).eq('question_id', questionId);
    } else {
      const q = questions.find(q => q.id === questionId);
      await supabase.from('lc_answers').insert([{
        attempt_id: attempt.id, user_id: user.id, quiz_session_id: session.id,
        question_id: questionId, answer, is_correct: q?.correct_answer === answer,
      }]);
      setSavedAnswers(p => ({ ...p, [questionId]: answer }));
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      setDialog({
        type: 'confirm', title: 'Submit Quiz',
        message: 'Submit jawaban sekarang? Pastikan semua soal sudah dijawab.',
        confirmLabel: 'Submit Sekarang',
        onConfirm: () => handleSubmit(true),
      });
      return;
    }
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    let correct = 0;
    questions.forEach(q => { if ((answers[q.id] ?? savedAnswers[q.id]) === q.correct_answer) correct++; });
    const score = questions.length ? (correct / questions.length) * 100 : 0;
    const passed = score >= session.passing_grade;
    await Promise.all(questions.map(q => {
      const ans = answers[q.id] ?? savedAnswers[q.id];
      if (!ans) return;
      return supabase.from('lc_answers').update({ is_correct: ans === q.correct_answer })
        .eq('attempt_id', attempt.id).eq('question_id', q.id);
    }));
    await supabase.from('lc_quiz_attempts').update({
      submitted_at: new Date().toISOString(), score, total_correct: correct,
      total_questions: questions.length, passed, is_submitted: true, time_taken_sec: timeTaken,
      tab_switches: tabSwitchesRef.current,
    }).eq('id', attempt.id);
    setResult({ score, correct, passed }); setSubmitted(true);
  };

  const fmtTimer = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (submitted && result) {
    if (showReview) {
      return (
        <div className="flex h-full flex-col overflow-y-auto" style={{ background: '#f8fafc' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-slate-200" style={{ background: '#ffffff' }}>
            <div>
              <h2 className="font-bold text-slate-800">📋 Review Jawaban</h2>
              <p className="text-xs text-slate-500">{session.session_name} · Skor {result.score.toFixed(0)}</p>
            </div>
            <button onClick={() => setShowReview(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">← Kembali ke Hasil</button>
          </div>
          <div className="p-8 space-y-4 max-w-3xl mx-auto w-full">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id] ?? savedAnswers[q.id] ?? null;
              const isCorrect = userAnswer === q.correct_answer;
              const notAnswered = !userAnswer;
              return (
                <div key={q.id} className={`rounded-2xl border-2 p-5 bg-white ${notAnswered ? 'border-slate-200' : isCorrect ? 'border-emerald-300' : 'border-rose-300'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-400 mb-1">Soal {idx+1}</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-10">
                    {(['A','B','C','D'] as const).map(opt => {
                      const optVal = (q as any)[`option_${opt.toLowerCase()}`];
                      const isUserChoice = userAnswer === opt;
                      const isCorrectOpt = q.correct_answer === opt;
                      let cls = 'bg-slate-50 border-slate-200 text-slate-600';
                      if (isCorrectOpt) cls = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold';
                      if (isUserChoice && !isCorrectOpt) cls = 'bg-rose-50 border-rose-400 text-rose-800 font-bold';
                      return (
                        <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs ${cls}`}>
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
                          <span className="flex-1">{optVal}</span>
                          {isCorrectOpt && <span className="text-emerald-600">✓</span>}
                          {isUserChoice && !isCorrectOpt && <span className="text-rose-600">←</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full p-8" style={{ background: '#f1f5f9' }}>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-10 max-w-md w-full text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl ${result.passed ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {result.passed ? '🎉' : '😔'}
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-1">{result.passed ? 'Selamat, Lulus!' : 'Belum Lulus'}</h2>
          <p className="text-slate-500 text-sm mb-8">{session.session_name}</p>
          <div className={`text-7xl font-black mb-1 ${result.passed ? 'text-emerald-500' : 'text-rose-500'}`}>{result.score.toFixed(0)}</div>
          <p className="text-slate-400 text-sm mb-2">dari 100 poin</p>
          <div className="flex justify-center gap-4 text-xs text-slate-500 mb-8">
            <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold">✓ {result.correct}/{questions.length} benar</span>
            <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold">Passing: {session.passing_grade}%</span>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowReview(true)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold rounded-xl shadow-sm transition-all text-sm">
              📋 Review Jawaban
            </button>
            <button onClick={onDone}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition-all text-sm">
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400" style={{ background: '#f8fafc' }}>Memuat soal...</div>;
  }

  const q = questions[current];
  const answered = Object.keys(answers).filter(k => answers[k]).length;
  const progress = ((current + 1) / questions.length) * 100;
  const isUrgent = timeLeft !== null && timeLeft < 60;

  return (
    <>
    <div className="flex h-full" style={{ background: '#f1f5f9' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 flex-shrink-0" style={{ background: '#ffffff' }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-sm truncate">{session.session_name}</h2>
              <p className="text-xs text-slate-400">{answered}/{questions.length} dijawab</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-sm tabular-nums ${isUrgent ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                ⏱ {fmtTimer(timeLeft)}
              </div>
            )}
            <button onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow transition-all">
              Submit
            </button>
          </div>
        </div>
        <div className="h-1 bg-slate-200 flex-shrink-0">
          <div className="h-1 bg-slate-700 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Soal {current + 1} / {questions.length}</span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>{q.difficulty}</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-5">
              <p className="text-base font-semibold text-slate-800 leading-relaxed">{q.question}</p>
            </div>
            <div className="space-y-3">
              {(['A','B','C','D'] as const).map(opt => {
                const val = (q as any)[`option_${opt.toLowerCase()}`];
                const selected = (answers[q.id] ?? savedAnswers[q.id]) === opt;
                return (
                  <button key={opt} onClick={() => handleAnswer(q.id, opt)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                      ${selected ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 transition-all
                      ${selected ? 'bg-white text-slate-800' : 'bg-slate-100 text-slate-500'}`}>{opt}</span>
                    <span className="text-sm font-medium flex-1">{val}</span>
                    {selected && (
                      <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setCurrent(p => Math.max(0, p-1))} disabled={current === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Sebelumnya
              </button>
              <button onClick={() => setCurrent(p => Math.min(questions.length-1, p+1))} disabled={current === questions.length-1}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
                Berikutnya
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden sm:flex w-48 bg-white border-l border-slate-200 p-4 overflow-y-auto flex-shrink-0 flex-col gap-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navigasi Soal</p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((_, i) => {
            const ans = answers[questions[i].id] ?? savedAnswers[questions[i].id];
            const isActive = i === current;
            return (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                  ${isActive ? 'bg-slate-800 text-white shadow-md' : ans ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {i+1}
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-800 flex-shrink-0" />Aktif</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300 flex-shrink-0" />Dijawab</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 flex-shrink-0" />Belum</div>
        </div>
        {tabSwitches > 0 && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">⚠️ Tab switch: {tabSwitches}x</div>
        )}
        <div className="mt-auto pt-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 text-center">{answered} / {questions.length} dijawab</p>
        </div>
      </div>
    </div>
    {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}

export function MyQuizPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeAttempts, setActiveAttempts] = useState<Record<string, QuizAttempt>>({});
  const [playingSession, setPlayingSession] = useState<QuizSession | null>(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('lc_quiz_sessions').select('*').eq('is_active', true).order('created_at', { ascending: false });
    const now = new Date();
    const filtered = ((s ?? []) as QuizSession[]).filter(sess => {
      const forMe = !sess.target_user_ids || sess.target_user_ids.includes(user.id);
      const notYetOpen = sess.open_at && new Date(sess.open_at) > now;
      const alreadyClosed = sess.close_at && new Date(sess.close_at) < now;
      return forMe && !notYetOpen && !alreadyClosed;
    });
    setSessions(filtered);
    const { data: a } = await supabase.from('lc_quiz_attempts').select('*').eq('user_id', user.id).eq('is_submitted', false);
    const map: Record<string, QuizAttempt> = {};
    (a ?? []).forEach((att: any) => { map[att.quiz_session_id] = att; });
    setActiveAttempts(map);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const handleStart = async (session: QuizSession) => {
    if (activeAttempts[session.id]) { setPlayingSession(session); return; }
    if (!session.allow_retake) {
      const { data: prev } = await supabase.from('lc_quiz_attempts')
        .select('id').eq('user_id', user.id).eq('quiz_session_id', session.id).eq('is_submitted', true);
      if (prev && prev.length > 0) {
        setDialog({ type: 'info', title: 'Tidak Bisa Retake', message: 'Quiz ini tidak mengizinkan retake. Kamu sudah pernah submit.' });
        return;
      }
    }
    const { data: att, error } = await supabase.from('lc_quiz_attempts').insert([{
      user_id: user.id, quiz_session_id: session.id, total_questions: session.question_count,
    }]).select().single();
    if (error || !att) {
      setDialog({ type: 'error', message: 'Gagal memulai quiz: ' + error?.message });
      return;
    }
    await load();
    setPlayingSession(session);
  };

  if (playingSession) {
    return <QuizPlayer session={playingSession} user={user}
      attempt={activeAttempts[playingSession.id]!}
      onDone={() => { setPlayingSession(null); load(); }} />;
  }

  const filteredSessions = search
    ? sessions.filter(s =>
        s.session_name.toLowerCase().includes(search.toLowerCase()) ||
        s.materi_name.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📝 My Quiz</h1>
          <p className="text-sm text-slate-500 mt-0.5">Quiz yang tersedia untuk kamu</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari quiz..." />
      </div>
      <div className="p-8 grid grid-cols-1 gap-4">
        {filteredSessions.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-semibold text-slate-700">{search ? 'Tidak ada quiz yang cocok' : 'Belum ada quiz aktif'}</p>
              {!search && <p className="text-sm mt-1 text-slate-500">Tunggu admin membuat sesi quiz baru</p>}
            </div>
          </div>
        )}
        {filteredSessions.map(s => {
          const inProgress = activeAttempts[s.id];
          return (
            <div key={s.id} className="stagger-item rounded-2xl border border-white/60 shadow-sm p-6 flex items-start gap-5 hover:shadow-md transition-all"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-lg">{s.session_name}</h4>
                <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  <span>📝 {s.question_count} soal</span>
                  <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                  <span>🎯 Passing: {s.passing_grade}%</span>
                  <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                </div>
                {inProgress && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">⏳ Sedang Berlangsung</span>
                  </div>
                )}
              </div>
              <button onClick={() => handleStart(s)}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow transition-all flex-shrink-0 ${inProgress ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                {inProgress ? '▶️ Lanjutkan' : '🚀 Mulai Quiz'}
              </button>
            </div>
          );
        })}
      </div>
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
