'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, User, QuizSession, QuizAttempt, DialogState } from './shared';
import { compressImage } from '@/lib/image-compress';
import { terjemahkanGalatUnggah, acakDenganBenih, type QuizQuestion } from './kuis/bantu-kuis';

export interface QuizPlayerKonteks {
  session: QuizSession;
  attempt: QuizAttempt;
  user: User;
}

export function useQuizPlayer(k: QuizPlayerKonteks) {
  const { session, attempt, user } = k;
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
  return {
    submitted, result, showReview, setShowReview, questions, answers, savedAnswers, perQuestionResult,
    current, timeLeft, setCurrent, fmtTimer, handleSubmit, setKonfirmasiKeluar, gambarJawaban, handleAnswer,
    handleUploadGambar, isEssay, setAnswers, unggah, tabSwitches, dialog, setDialog, konfirmasiKeluar,
  };
}
