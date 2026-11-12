'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, QuizSession, QuizAttempt, SearchInput, AppDialog, DialogState } from './shared';
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { cetakSertifikat, unduhSertifikat } from './sertifikat';
import { DaftarSesiKuis } from './kuis/DaftarSesiKuis';
import { BilahNavigasiSoal } from './kuis/BilahNavigasiSoal';
import { IsiSoalKuis } from './kuis/IsiSoalKuis';
import { BilahAtasKuis } from './kuis/BilahAtasKuis';
import { GambarSoal } from '@/components/shared/GambarSoal';
import { useQuizPlayer } from './useQuizPlayer';

function QuizPlayer({ session, user, attempt, onDone, onRetake }: {
  session: QuizSession; user: User; attempt: QuizAttempt; onDone: () => void;
  onRetake?: (session: QuizSession) => void;
}) {
  const {
    submitted, result, showReview, setShowReview, questions, answers, savedAnswers, perQuestionResult,
    current, timeLeft, setCurrent, fmtTimer, handleSubmit, setKonfirmasiKeluar, gambarJawaban, handleAnswer,
    handleUploadGambar, isEssay, setAnswers, unggah, tabSwitches, dialog, setDialog, konfirmasiKeluar,
  } = useQuizPlayer({ session, attempt, user });

  if (submitted && result) {
    if (showReview) {
      return (
        <div className="flex h-full flex-col overflow-y-auto" style={{ background: '#f8fafc' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-slate-200" style={{ background: '#ffffff' }}>
            <div>
              <h2 className="font-bold text-slate-800"><IkonTeks nama="📋" />Review Jawaban</h2>
              <p className="text-xs text-slate-500">{session.session_name} · Skor {result.score.toFixed(0)}</p>
            </div>
            <button onClick={() => setShowReview(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">← Kembali ke Hasil</button>
          </div>
          <div className="p-4 sm:p-8 space-y-4 max-w-3xl mx-auto w-full">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id] ?? savedAnswers[q.id] ?? null;
              const correctAnswer = perQuestionResult[q.id]?.correct_answer;
              const isCorrect = perQuestionResult[q.id]?.is_correct ?? false;
              const notAnswered = !userAnswer;
              return (
                <div key={q.id} className={`rounded-2xl border-2 p-5 bg-white ${notAnswered ? 'border-slate-200' : isCorrect ? 'border-emerald-300' : 'border-rose-300'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1}</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                      <GambarSoal url={q.gambar_url} tinggi="max-h-48" className="mx-0! mt-2 border border-slate-200" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-2 sm:ml-10">
                    {(['A','B','C','D'] as const).map(opt => {
                      const optVal = (q as any)[`option_${opt.toLowerCase()}`];
                      const isUserChoice = userAnswer === opt;
                      const isCorrectOpt = correctAnswer === opt;
                      let cls = 'bg-slate-50 border-slate-200 text-slate-600';
                      if (isCorrectOpt) cls = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold';
                      if (isUserChoice && !isCorrectOpt) cls = 'bg-rose-50 border-rose-400 text-rose-800 font-bold';
                      return (
                        <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs ${cls}`}>
                          <span className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-black shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
                          <span className="flex-1">{optVal}</span>
                          {isCorrectOpt && <span className="text-emerald-700">✓</span>}
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
          {result.pendingReview ? (
            <>
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl bg-amber-100"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-1">Jawaban Terkirim</h2>
              <p className="text-slate-500 text-sm mb-6">{session.session_name}</p>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Ini adalah quiz essay. Jawabanmu sudah tersimpan dan akan dinilai manual oleh admin.
                Skor akan muncul di halaman Riwayat &amp; Nilai Saya setelah admin selesai menilai.
              </p>
              <button onClick={onDone}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all text-sm">
                Selesai
              </button>
            </>
          ) : (
          <>
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl ${result.passed ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {result.passed ? '🎉' : '😔'}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-1">{result.passed ? 'Selamat, Lulus!' : 'Belum Lulus'}</h2>
          <p className="text-slate-500 text-sm mb-8">{session.session_name}</p>
          <div className={`text-5xl sm:text-7xl font-black mb-1 ${result.passed ? 'text-emerald-700' : 'text-rose-500'}`}>{result.score.toFixed(0)}</div>
          <p className="text-slate-500 text-sm mb-2">dari 100 poin</p>
          <div className="flex justify-center gap-4 text-xs text-slate-500 mb-8">
            <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold">✓ {result.correct}/{questions.length} benar</span>
            <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold">Passing: {session.passing_grade}%</span>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => setShowReview(true)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold rounded-xl shadow-xs transition-all text-sm">
              <IkonTeks nama="📋" />Review Jawaban
            </button>
            {!result.passed && session.allow_retake && onRetake && (
              <button onClick={() => onRetake(session)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-all text-sm">
                <IkonTeks nama="🔄" />Coba Lagi
              </button>
            )}
            {result.passed && !result.pendingReview && (() => {
              const d = { nama: user.full_name, sesi: session.session_name, materi: session.materi_name, passing: session.passing_grade,
                attempt: { id: attempt.id, passed: true, is_submitted: true, score: result.score, submitted_at: new Date().toISOString(), grading_status: 'auto' as const } };
              return (
                <>
                  <button onClick={() => void unduhSertifikat(d)} title="Unduh sertifikat (PNG)"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-all text-sm"><IkonTeks nama="🎓" />Sertifikat</button>
                  <button onClick={() => cetakSertifikat(d)} title="Cetak sertifikat" aria-label="Cetak sertifikat"
                    className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all text-sm"><Ikon nama="🖨" ukuran={16} /></button>
                </>
              );
            })()}
            <button onClick={onDone}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all text-sm">
              Selesai
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500" style={{ background: '#f8fafc' }}>Memuat soal...</div>;
  }

  const q = questions[current];
  const answered = Object.keys(answers).filter(k => answers[k]).length;

  const totalDetik = session.timer_minutes ? session.timer_minutes * 60 : null;
  const tingkatWaktu: 'tenang' | 'waspada' | 'kritis' =
    timeLeft === null ? 'tenang'
      : timeLeft <= 60 ? 'kritis'
      : (totalDetik !== null && timeLeft <= totalDetik * 0.25) ? 'waspada'
      : 'tenang';
  const isUrgent = tingkatWaktu === 'kritis';
  const WARNA_WAKTU = { tenang: '#059669', waspada: '#D97706', kritis: '#DC2626' } as const;
  const KET_WAKTU = { tenang: 'Sisa waktu', waspada: 'Waktu menipis', kritis: 'Segera kumpulkan' } as const;
  const KELILING = 2 * Math.PI * 19;
  const porsiWaktu = (timeLeft !== null && totalDetik) ? Math.max(0, Math.min(1, timeLeft / totalDetik)) : 1;

  const relSoal = () => (
    <div className="flex gap-[3px] px-4 sm:px-6 py-3 overflow-x-auto shrink-0 bg-white border-b border-slate-200"
      role="group" aria-label="Navigasi soal">
      {questions.map((qq, i) => {
        const sudah = !!(answers[qq.id] ?? savedAnswers[qq.id]);
        const kini = i === current;
        return (
          <button key={qq.id} onClick={() => setCurrent(i)}
            aria-label={`Soal ${i + 1}${sudah ? ' (sudah dijawab)' : ' (belum dijawab)'}`}
            aria-current={kini ? 'true' : undefined}
            className="flex-1 min-w-[14px] rounded-sm p-0 border-0 cursor-pointer transition-all hover:scale-y-150"
            style={{
              height: kini ? 12 : 7,
              alignSelf: 'center',
              background: kini ? '#1E293B' : sudah ? '#10B981' : '#E2E8F0',
            }} />
        );
      })}
    </div>
  );

  return (
    <ModalPortal>
    <>
    <div className="fixed inset-0 z-250 flex bg-slate-100">
      <div className="flex-1 flex flex-col overflow-hidden">

        <BilahAtasKuis
          KELILING={KELILING} KET_WAKTU={KET_WAKTU} WARNA_WAKTU={WARNA_WAKTU} answered={answered} fmtTimer={fmtTimer} handleSubmit={handleSubmit} isUrgent={isUrgent} porsiWaktu={porsiWaktu} questions={questions} session={session} setKonfirmasiKeluar={setKonfirmasiKeluar} timeLeft={timeLeft} tingkatWaktu={tingkatWaktu}
        />

        {relSoal()}

        <IsiSoalKuis
          answers={answers} current={current} gambarJawaban={gambarJawaban} handleAnswer={handleAnswer} handleUploadGambar={handleUploadGambar} isEssay={isEssay} q={q} questions={questions} savedAnswers={savedAnswers} setAnswers={setAnswers} setCurrent={setCurrent} unggah={unggah}
        />

        <BilahNavigasiSoal
          answered={answered} current={current} handleSubmit={handleSubmit} questions={questions} setCurrent={setCurrent} tabSwitches={tabSwitches}
        />
      </div>
    </div>
    {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}

    {konfirmasiKeluar && (
      <div className="fixed inset-0 z-260 flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.6)' }}
        onClick={() => setKonfirmasiKeluar(false)}>
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
          aria-labelledby="judul-keluar-quiz">
          <div className="px-5 py-4 bg-rose-600 text-white">
            <h3 id="judul-keluar-quiz" className="font-bold text-base">Keluar dari quiz?</h3>
          </div>
          <div className="p-5 space-y-2 text-[13px] leading-relaxed">
            <p className="text-slate-700">
              Jawaban yang sudah kamu isi <strong>tetap tersimpan</strong> — {answered} dari {questions.length} soal.
            </p>
            {timeLeft !== null && (
              <p className="text-rose-700">
                Tetapi <strong>waktunya terus berjalan</strong> ({fmtTimer(timeLeft)} tersisa) dan tidak
                berhenti saat kamu keluar.
              </p>
            )}
            <p className="text-slate-500">
              Quiz baru dinilai setelah kamu menekan <strong>Submit</strong>.
            </p>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setKonfirmasiKeluar(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">
              Lanjut Mengerjakan
            </button>
            <button onClick={() => { setKonfirmasiKeluar(false); onDone(); }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700">
              Ya, Keluar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
    </ModalPortal>
  );
}

export function MyQuizPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeAttempts, setActiveAttempts]     = useState<Record<string, QuizAttempt>>({});
  const [submittedSessionIds, setSubmittedIds]  = useState<Set<string>>(new Set());
  const [pendingReviewIds, setPendingReviewIds] = useState<Set<string>>(new Set());
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
    (a ?? []).forEach((att) => { if (att.quiz_session_id) map[att.quiz_session_id] = att as QuizAttempt; });
    setActiveAttempts(map);

    const { data: submitted } = await supabase
      .from('lc_quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_submitted', true);
    setSubmittedIds(new Set((submitted ?? []).map((r) => r.quiz_session_id).filter((x): x is string => !!x)));
    setPendingReviewIds(new Set((submitted ?? []).filter((r) => r.grading_status === 'pending_review').map((r) => r.quiz_session_id).filter((x): x is string => !!x)));
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
      onDone={() => { setPlayingSession(null); load(); }}
      onRetake={handleStart} />;
  }

  const filteredSessions = search
    ? sessions.filter(s =>
        s.session_name.toLowerCase().includes(search.toLowerCase()) ||
        s.materi_name.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="📝" />My Quiz</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Quiz yang tersedia untuk kamu</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari quiz..." />
      </div>
      <DaftarSesiKuis
        activeAttempts={activeAttempts} filteredSessions={filteredSessions} handleStart={handleStart} pendingReviewIds={pendingReviewIds} search={search} submittedSessionIds={submittedSessionIds}
      />
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
