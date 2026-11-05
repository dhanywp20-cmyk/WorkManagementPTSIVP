'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, User, QuizSession, QuizAttempt, SearchInput, AppDialog, DialogState } from './shared';
import { ModalPortal } from '@/components/shared';
import { compressImage } from '@/lib/image-compress';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { cetakSertifikat, unduhSertifikat } from './sertifikat';
import { DaftarSesiKuis } from './kuis/DaftarSesiKuis';
import { BilahNavigasiSoal } from './kuis/BilahNavigasiSoal';
import { IsiSoalKuis } from './kuis/IsiSoalKuis';
import { BilahAtasKuis } from './kuis/BilahAtasKuis';
import { GambarSoal } from '@/components/shared/GambarSoal';
import { terjemahkanGalatUnggah, acakDenganBenih, type QuizQuestion } from './kuis/bantu-kuis';

function QuizPlayer({ session, user, attempt, onDone, onRetake }: {
  session: QuizSession; user: User; attempt: QuizAttempt; onDone: () => void;
  onRetake?: (session: QuizSession) => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [gambarJawaban, setGambarJawaban] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; passed: boolean; pendingReview?: boolean } | null>(null);
  const [perQuestionResult, setPerQuestionResult] = useState<Record<string, { correct_answer: string; is_correct: boolean }>>({});
  const isEssay = session.session_type === 'essay';
  const [timeLeft, setTimeLeft] = useState<number | null>(session.timer_minutes ? session.timer_minutes * 60 : null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const tabSwitchesRef = useRef(0);
  const [showReview, setShowReview] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [konfirmasiKeluar, setKonfirmasiKeluar] = useState(false);

  useEffect(() => {
    const kirim = (tipe: 'IFRAME_MODAL_OPEN' | 'IFRAME_MODAL_CLOSE') => {
      try {
        if (window.parent !== window) {
          window.parent.postMessage({ type: tipe, modul: 'learning-quiz' }, window.location.origin);
        }
      } catch {  }
    };
    kirim('IFRAME_MODAL_OPEN');
    return () => kirim('IFRAME_MODAL_CLOSE');
  }, []);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      if (!session.question_ids?.length) return;
      const { data } = await supabase.from('lc_questions')
        .select('id, material_id, materi_name, question, option_a, option_b, option_c, option_d, difficulty, batch_name, created_at, urutan, question_type, answer_format, gambar_url')
        .in('id', session.question_ids);
      const ordered = session.question_ids.map(id => data?.find((q: any) => q.id === id)).filter(Boolean) as QuizQuestion[];
      setQuestions(session.acak_soal ? acakDenganBenih(ordered, attempt.id) : ordered);
    };
    load();
    const loadAnswers = async () => {
      const { data } = await supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id);
      const map: Record<string, string> = {};
      const gbr: Record<string, string> = {};
      (data ?? []).forEach((a: any) => {
        map[a.question_id] = a.essay_text || a.answer_image_url || a.answer;
        if (a.answer_thumb_url) gbr[a.question_id] = a.answer_thumb_url;
      });
      setSavedAnswers(map); setAnswers(map); setGambarJawaban(gbr);
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

  const [unggah, setUnggah] = useState<string | null>(null);

  const handleUploadGambar = async (questionId: string, file: File): Promise<boolean> => {
    if (!file.type.startsWith('image/')) {
      setDialog({ type: 'error', title: 'Bukan gambar', message: 'Pilih berkas foto (JPG/PNG).' });
      return false;
    }
    setUnggah(questionId);
    try {
      const [penuh, kecil] = await Promise.all([
        compressImage(file, { maxDim: 1600, quality: 0.75 }),
        compressImage(file, { maxDim: 320, quality: 0.6 }),
      ]);
      const dasar = `${attempt.id}/${questionId}-${crypto.randomUUID()}`;
      const [u1, u2] = await Promise.all([
        supabase.storage.from('learning-answers').upload(`${dasar}.jpg`, penuh, { cacheControl: '31536000', upsert: false }),
        supabase.storage.from('learning-answers').upload(`${dasar}-thumb.jpg`, kecil, { cacheControl: '31536000', upsert: false }),
      ]);
      if (u1.error || u2.error) throw new Error(terjemahkanGalatUnggah(u1.error?.message || u2.error?.message));

      const urlPenuh = supabase.storage.from('learning-answers').getPublicUrl(`${dasar}.jpg`).data.publicUrl;
      const urlKecil = supabase.storage.from('learning-answers').getPublicUrl(`${dasar}-thumb.jpg`).data.publicUrl;

      const isi = { answer_image_url: urlPenuh, answer_thumb_url: urlKecil, answered_at: new Date().toISOString() };
      const sudahAda = savedAnswers[questionId] !== undefined;
      const { data: hasil, error } = sudahAda
        ? await supabase.from('lc_answers').update(isi)
            .eq('attempt_id', attempt.id).eq('question_id', questionId).select('id')
        : await supabase.from('lc_answers').insert([{
            attempt_id: attempt.id, user_id: user.id, quiz_session_id: session.id,
            question_id: questionId, answer: '', essay_text: null, is_correct: false, ...isi,
          }]).select('id');
      if (error) throw new Error(error.message);
      if (!hasil || hasil.length === 0) throw new Error('tersimpan 0 baris - tidak ada perubahan yang tercatat');

      setGambarJawaban(p => ({ ...p, [questionId]: urlKecil }));
      setSavedAnswers(p => ({ ...p, [questionId]: urlPenuh }));
      setAnswers(p => ({ ...p, [questionId]: urlPenuh }));
      setUnggah(null);
      return true;
    } catch (e) {
      setUnggah(null);
      setDialog({
        type: 'error', title: 'Gagal mengunggah',
        message: e instanceof Error ? e.message : 'Coba lagi, atau periksa koneksi.',
      });
      return false;
    }
  };

  const handleAnswer = async (questionId: string, answer: string): Promise<boolean> => {
    setAnswers(p => ({ ...p, [questionId]: answer }));
    const existing = savedAnswers[questionId];
    let error: { message: string } | null = null;
    if (isEssay) {
      if (existing !== undefined) {
        const r = await supabase.from('lc_answers').update({ essay_text: answer, answered_at: new Date().toISOString() })
          .eq('attempt_id', attempt.id).eq('question_id', questionId).select('id');
        error = r.error ?? (!r.data || r.data.length === 0 ? { message: 'tersimpan 0 baris' } : null);
      } else {
        ({ error } = await supabase.from('lc_answers').insert([{
          attempt_id: attempt.id, user_id: user.id, quiz_session_id: session.id,
          question_id: questionId, answer: '', essay_text: answer, is_correct: false,
        }]));
        if (!error) setSavedAnswers(p => ({ ...p, [questionId]: answer }));
      }
    } else if (existing) {
      const r = await supabase.from('lc_answers').update({ answer, answered_at: new Date().toISOString() })
        .eq('attempt_id', attempt.id).eq('question_id', questionId).select('id');
      error = r.error ?? (!r.data || r.data.length === 0 ? { message: 'tersimpan 0 baris' } : null);
    } else {
      ({ error } = await supabase.from('lc_answers').insert([{
        attempt_id: attempt.id, user_id: user.id, quiz_session_id: session.id,
        question_id: questionId, answer, is_correct: false,
      }]));
      if (!error) setSavedAnswers(p => ({ ...p, [questionId]: answer }));
    }
    if (error) {
      setDialog({ type: 'error', title: 'Jawaban Gagal Tersimpan', message: `Jawaban belum tersimpan ke server (${error.message}). Coba ketik ulang atau periksa koneksi internet kamu sebelum lanjut.` });
      return false;
    }
    return true;
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

    if (isEssay) {
      const flushResults = await Promise.all(
        questions.map(q => {
          const text = answers[q.id] ?? savedAnswers[q.id] ?? '';
          return handleAnswer(q.id, text);
        }),
      );
      if (flushResults.some(ok => !ok)) {
        return;
      }
      const { error } = await supabase.from('lc_quiz_attempts').update({
        submitted_at: new Date().toISOString(), score: null, total_correct: 0,
        total_questions: questions.length, passed: null, is_submitted: true, time_taken_sec: timeTaken,
        tab_switches: tabSwitchesRef.current, grading_status: 'pending_review',
      }).eq('id', attempt.id);
      if (error) {
        setDialog({ type: 'error', title: 'Submit Gagal', message: `Jawabanmu sudah tersimpan, tapi status submit gagal disimpan (${error.message}). Coba klik Submit sekali lagi.` });
        return;
      }
      setResult({ score: 0, correct: 0, passed: false, pendingReview: true }); setSubmitted(true);
      return;
    }

    let res: Response;
    try {
      res = await fetch('/api/learning-center/submit-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, tabSwitches: tabSwitchesRef.current }),
      });
    } catch {
      setDialog({ type: 'error', title: 'Submit Gagal', message: 'Gagal menghubungi server. Periksa koneksi internet lalu coba lagi.' });
      return;
    }
    const hasil = await res.json().catch(() => null);
    if (!res.ok || !hasil) {
      setDialog({ type: 'error', title: 'Submit Gagal', message: `Gagal menyimpan hasil quiz (${hasil?.error ?? res.statusText}). Coba klik Submit sekali lagi.` });
      return;
    }
    const { score, correct, passed, perQuestion } = hasil as {
      score: number; correct: number; passed: boolean;
      perQuestion: Record<string, { correct_answer: string; is_correct: boolean }>;
    };
    setPerQuestionResult(perQuestion);
    setResult({ score, correct, passed }); setSubmitted(true);
  };

  const fmtTimer = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

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
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1}</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                      <GambarSoal url={q.gambar_url} tinggi="max-h-48" className="!mx-0 mt-2 border border-slate-200" />
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
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-black flex-shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
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
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition-all text-sm">
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
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold rounded-xl shadow-sm transition-all text-sm">
              <IkonTeks nama="📋" />Review Jawaban
            </button>
            {!result.passed && session.allow_retake && onRetake && (
              <button onClick={() => onRetake(session)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow transition-all text-sm">
                <IkonTeks nama="🔄" />Coba Lagi
              </button>
            )}
            {result.passed && !result.pendingReview && (() => {
              const d = { nama: user.full_name, sesi: session.session_name, materi: session.materi_name, passing: session.passing_grade,
                attempt: { id: attempt.id, passed: true, is_submitted: true, score: result.score, submitted_at: new Date().toISOString(), grading_status: 'auto' as const } };
              return (
                <>
                  <button onClick={() => void unduhSertifikat(d)} title="Unduh sertifikat (PNG)"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow transition-all text-sm"><IkonTeks nama="🎓" />Sertifikat</button>
                  <button onClick={() => cetakSertifikat(d)} title="Cetak sertifikat" aria-label="Cetak sertifikat"
                    className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all text-sm"><Ikon nama="🖨" ukuran={16} /></button>
                </>
              );
            })()}
            <button onClick={onDone}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition-all text-sm">
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
    <div className="flex gap-[3px] px-4 sm:px-6 py-3 overflow-x-auto flex-shrink-0 bg-white border-b border-slate-200"
      role="group" aria-label="Navigasi soal">
      {questions.map((qq, i) => {
        const sudah = !!(answers[qq.id] ?? savedAnswers[qq.id]);
        const kini = i === current;
        return (
          <button key={qq.id} onClick={() => setCurrent(i)}
            aria-label={`Soal ${i + 1}${sudah ? ' (sudah dijawab)' : ' (belum dijawab)'}`}
            aria-current={kini ? 'true' : undefined}
            className="flex-1 min-w-[14px] rounded p-0 border-0 cursor-pointer transition-all hover:scale-y-150"
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
    <div className="fixed inset-0 z-[250] flex bg-slate-100">
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
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-4"
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
    (a ?? []).forEach((att: any) => { map[att.quiz_session_id] = att; });
    setActiveAttempts(map);

    const { data: submitted } = await supabase
      .from('lc_quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_submitted', true);
    setSubmittedIds(new Set((submitted ?? []).map((r: any) => r.quiz_session_id)));
    setPendingReviewIds(new Set((submitted ?? []).filter((r: any) => r.grading_status === 'pending_review').map((r: any) => r.quiz_session_id)));
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
