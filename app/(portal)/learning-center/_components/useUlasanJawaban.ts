'use client';

import { useState, useEffect } from 'react';
import { supabase, User, Question, DialogState } from './shared';
import { gradeEssayWithAI, gradeEssaysBatchWithAI, type SoalDinilai, ambilDaftarModel, type ModelAI } from './penilai-ai';
import { ambilPengaturanPenilai, simpanPengaturanPenilai, PENILAI_BAWAAN, type PengaturanPenilai } from '@/lib/ai-pengaturan';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { getSession } from '@/lib/auth/sesi';
import { createNotification } from '@/lib/notifications';
import type { Tables } from '@/types/database';

export type PercobaanUlasan = Tables<'lc_quiz_attempts'> & {
  lc_quiz_sessions: Pick<Tables<'lc_quiz_sessions'>, 'session_name' | 'passing_grade' | 'materi_name' | 'question_ids'> | null;
};

export interface UlasanJawabanKonteks {
  isAdminView: boolean;
  user: User;
  autoOpenAttemptId: string | null | undefined;
}

export function useUlasanJawaban(k: UlasanJawabanKonteks) {
  const { isAdminView, user, autoOpenAttemptId } = k;
  const [attempts, setAttempts] = useState<PercobaanUlasan[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<PercobaanUlasan | null>(null);
  const [answerDetails, setAnswerDetails] = useState<Tables<'lc_answers'>[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const [aiGradingIds, setAiGradingIds] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [aiScores, setAiScores] = useState<Record<string, number>>({});
  const [menilaiBorongan, setMenilaiBorongan] = useState(false);
  const [setelanPenilai, setSetelanPenilai] = useState<PengaturanPenilai>(PENILAI_BAWAAN);
  const [daftarModel, setDaftarModel] = useState<ModelAI[]>([]);
  const [galatModel, setGalatModel] = useState('');
  const bolehAturModel = isAdminView && hasFullAccess(getSession<User>() ?? {});
  const bolehNilai = isAdminView && !isPimpinan(getSession<User>() ?? {});

  useEffect(() => {
    ambilPengaturanPenilai().then(setSetelanPenilai).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bolehAturModel) return;
    ambilDaftarModel('penilai')
      .then(m => { setDaftarModel(m); setGalatModel(''); })
      .catch(e => setGalatModel(e instanceof Error ? e.message : 'Gagal membaca daftar model.'));
  }, [bolehAturModel]);

  const penilaiOtomatis = setelanPenilai.otomatis;

  const gantiModel = async (model: string) => {
    const bersih = model.trim();
    if (!bersih || bersih === setelanPenilai.model) return;
    const baru = { ...setelanPenilai, model: bersih };
    setSetelanPenilai(baru);
    const r = await simpanPengaturanPenilai(baru);
    if (!r.ok) {
      setDialog({ type: 'error', title: 'Model gagal disimpan', message: r.pesan ?? 'Coba lagi.' });
      ambilPengaturanPenilai().then(setSetelanPenilai).catch(() => {});
    }
  };

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => {
        const rows: PercobaanUlasan[] = data ?? [];
        setAttempts(rows);
        if (autoOpenAttemptId) {
          const target = rows.find((a) => a.id === autoOpenAttemptId);
          if (target) handleViewDetail(target);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, autoOpenAttemptId]);

  const handleViewDetail = async (attempt: PercobaanUlasan) => {
    setSelectedAttempt(attempt);
    setLoadingDetail(true);
    setAiFeedback({}); setAiGradingIds(new Set()); setAiError({}); setAiScores({});
    const questionIds: string[] = attempt.lc_quiz_sessions?.question_ids ?? [];
    const [{ data: ans }, { data: qs }] = await Promise.all([
      supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id),
      questionIds.length > 0
        ? supabase.from('lc_questions').select('*').in('id', questionIds)
        : Promise.resolve({ data: [] }),
    ]);
    const orderedQs = questionIds.map((id: string) => (qs ?? []).find((q) => q.id === id)).filter(Boolean) as Question[];
    setQuestions(orderedQs);
    setAnswerDetails(ans ?? []);
    const scoreMap: Record<string, string> = {};
    const feedbackMap: Record<string, string> = {};
    const aiScoreMap: Record<string, number> = {};
    (ans ?? []).forEach((a) => {
      if (!a.question_id) return;
      const adaManual = a.manual_score !== null && a.manual_score !== undefined;
      const adaAi     = a.ai_score !== null && a.ai_score !== undefined;
      if (a.ai_feedback) feedbackMap[a.question_id] = a.ai_feedback;
      if (adaAi) aiScoreMap[a.question_id] = Number(a.ai_score);
      if (adaManual)      scoreMap[a.question_id] = String(a.manual_score);
      else if (adaAi)     scoreMap[a.question_id] = String(a.ai_score);
    });
    setManualScores(scoreMap);
    setAiFeedback(feedbackMap);
    setAiScores(aiScoreMap);
    setLoadingDetail(false);

    if (bolehNilai && penilaiOtomatis) {
      const belum = orderedQs
        .filter(q => q.question_type === 'essay')
        .filter(q => scoreMap[q.id] === undefined && !feedbackMap[q.id])
        .map(q => ({ q, teks: (ans ?? []).find((x) => x.question_id === q.id)?.essay_text?.trim() }))
        .filter((x): x is { q: Question; teks: string } => !!x.teks);
      if (belum.length > 0) void nilaiBorongan(attempt.id, belum.map(x => x.q), ans ?? []);
    }
  };

  const nilaiBorongan = async (attemptId: string, daftarSoal: Question[], jawaban: Tables<'lc_answers'>[]) => {
    const bahan: SoalDinilai[] = daftarSoal
      .filter(q => q.question_type === 'essay')
      .map(q => ({
        id: q.id,
        question: q.question,
        modelAnswer: q.model_answer,
        studentAnswer: (jawaban.find((x) => x.question_id === q.id)?.essay_text ?? '').trim(),
      }))
      .filter(x => x.studentAnswer.length > 0);
    if (bahan.length === 0) {
      setDialog({ type: 'error', message: 'Tidak ada jawaban essay bertulisan yang bisa dinilai AI.' });
      return;
    }

    setMenilaiBorongan(true);
    setAiGradingIds(new Set(bahan.map(b => b.id)));
    setAiError({});
    try {
      const hasil = await gradeEssaysBatchWithAI(bahan);
      const idHasil = Object.keys(hasil);
      if (idHasil.length === 0) throw new Error('AI tidak mengembalikan penilaian satu pun.');

      setAiFeedback(p => ({ ...p, ...Object.fromEntries(idHasil.map(i => [i, hasil[i].feedback])) }));
      setAiScores(p => ({ ...p, ...Object.fromEntries(idHasil.map(i => [i, hasil[i].score])) }));
      setManualScores(p => {
        const n = { ...p };
        for (const i of idHasil) if (n[i] === undefined) n[i] = String(hasil[i].score);
        return n;
      });
      await Promise.all(idHasil.map(i =>
        supabase.from('lc_answers')
          .update({ ai_score: hasil[i].score, ai_feedback: hasil[i].feedback })
          .eq('attempt_id', attemptId).eq('question_id', i)
      ));

      const tertinggal = bahan.filter(b => !hasil[b.id]);
      if (tertinggal.length > 0) {
        setAiError(p => ({
          ...p,
          ...Object.fromEntries(tertinggal.map(t => [t.id, 'AI melewati soal ini - nilai manual.'])),
        }));
      }
    } catch (e) {
      const pesan = e instanceof Error ? e.message : 'AI gagal menilai.';
      setAiError(Object.fromEntries(bahan.map(b => [b.id, pesan])));
    } finally {
      setAiGradingIds(new Set());
      setMenilaiBorongan(false);
    }
  };

  const runAiGrading = async (attemptId: string, q: Question, studentText: string) => {
    setAiGradingIds(p => new Set(p).add(q.id));
    setAiError(p => { const n = { ...p }; delete n[q.id]; return n; });
    try {
      const result = await gradeEssayWithAI(q.question, q.model_answer, studentText);
      setAiFeedback(p => ({ ...p, [q.id]: result.feedback }));
      setAiScores(p => ({ ...p, [q.id]: result.score }));
      setManualScores(p => (p[q.id] !== undefined ? p : { ...p, [q.id]: String(result.score) }));
      void supabase.from('lc_answers')
        .update({ ai_score: result.score, ai_feedback: result.feedback })
        .eq('attempt_id', attemptId).eq('question_id', q.id);
    } catch (e) {
      setAiError(p => ({ ...p, [q.id]: e instanceof Error ? e.message : 'AI gagal menilai.' }));
    } finally {
      setAiGradingIds(p => { const n = new Set(p); n.delete(q.id); return n; });
    }
  };

  const handleSaveManualGrade = async () => {
    if (!selectedAttempt) return;
    const missing = questions.some(q => manualScores[q.id] === undefined || manualScores[q.id] === '');
    if (missing) { setDialog({ type: 'error', message: 'Isi nilai untuk semua soal essay terlebih dahulu (0-100).' }); return; }
    setSavingGrade(true);
    const grader = getSession<User>();
    await Promise.all(questions.map(q =>
      supabase.from('lc_answers').update({ manual_score: Number(manualScores[q.id]) })
        .eq('attempt_id', selectedAttempt.id).eq('question_id', q.id)
    ));
    const finalScore = questions.length
      ? questions.reduce((s, q) => s + (Number(manualScores[q.id]) || 0), 0) / questions.length
      : 0;
    const passingGrade = selectedAttempt.lc_quiz_sessions?.passing_grade ?? 70;
    const passed = finalScore >= passingGrade;
    const totalCorrect = questions.filter(q => (Number(manualScores[q.id]) || 0) >= passingGrade).length;
    const { data: terubah, error } = await supabase.from('lc_quiz_attempts').update({
      score: finalScore, passed, total_correct: totalCorrect, total_questions: questions.length,
      grading_status: 'graded', graded_by: grader?.id ?? null, graded_at: new Date().toISOString(),
    }).eq('id', selectedAttempt.id).eq('grading_status', 'pending_review').select('id');
    setSavingGrade(false);
    if (error || !terubah || terubah.length === 0) {
      if (!error) {
        const { data: cekAttempt } = await supabase.from('lc_quiz_attempts').select('grading_status').eq('id', selectedAttempt.id).single();
        if (cekAttempt?.grading_status === 'graded') {
          setDialog({ type: 'error', message: 'Essay ini baru saja dinilai oleh admin lain - nilai kamu TIDAK disimpan supaya tidak saling menimpa. Muat ulang untuk melihat nilai terbaru.' });
          return;
        }
      }
      setDialog({ type: 'error', message: 'Gagal menyimpan nilai essay. Coba lagi.' });
      return;
    }
    setSelectedAttempt((p) => p && ({ ...p, score: finalScore, passed, grading_status: 'graded' }));
    setDialog({ type: 'success', message: 'Nilai essay berhasil disimpan!' });

    const judulSesi = selectedAttempt?.lc_quiz_sessions?.session_name;
    if (selectedAttempt?.user_id) void createNotification({
      user_id: selectedAttempt.user_id,
      type: 'system',
      title: passed ? '✅ Essay kamu sudah dinilai — Lulus' : '📋 Essay kamu sudah dinilai',
      body: `${judulSesi ? `"${judulSesi}" — ` : ''}Skor: ${Math.round(finalScore)}${passed ? '' : ', belum lulus'}. Cek Riwayat & Nilai Saya.`,
      action_url: '/learning-center',
      created_by: grader?.full_name ?? 'Admin',
    });
  };

  const getAnswerFor = (questionId: string) => answerDetails.find(a => a.question_id === questionId);
  return {
    selectedAttempt, setSelectedAttempt, bolehAturModel, questions, daftarModel, setelanPenilai, gantiModel, galatModel,
    setSetelanPenilai, loadingDetail, getAnswerFor, bolehNilai, aiGradingIds, aiFeedback, aiScores, manualScores,
    aiError, setManualScores, runAiGrading, menilaiBorongan, savingGrade, nilaiBorongan, answerDetails, handleSaveManualGrade,
    dialog, setDialog, attempts, handleViewDetail,
  };
}
