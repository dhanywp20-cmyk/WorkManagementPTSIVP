'use client';

import { useState, useEffect, useCallback } from 'react';
import { ListEmptyState } from '@/components/shared';
import { supabase, User, Question, QuizAttempt, DIFF_COLOR, fmtDate, ScoreBadge, SearchInput, BtnView, GradingStatusBadge, AppDialog, DialogState, gradeEssayWithAI, gradeEssaysBatchWithAI, type SoalDinilai, ambilDaftarModel, type ModelAI } from './shared';
import { ambilPengaturanPenilai, simpanPengaturanPenilai, PENILAI_BAWAAN, type PengaturanPenilai } from '@/lib/ai-pengaturan';
import { hasFullAccess } from '@/lib/constants';
import { getSession } from '@/lib/auth';

function UserAnswerReview({ user, onBack, isAdminView, autoOpenAttemptId }: {
  user: User; onBack: () => void; isAdminView: boolean;
  /**
   * Langsung buka detail attempt ini begitu daftar selesai dimuat. Dipakai
   * tombol "Nilai Sekarang" di Laporan: admin sudah menunjuk satu jawaban,
   * jadi memaksanya memilih ulang dari daftar hanya menambah satu langkah
   * yang tidak perlu.
   */
  autoOpenAttemptId?: string | null;
}) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [answerDetails, setAnswerDetails] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  // Saran AI (bukan skor final - lihat gradeEssayWithAI di shared.tsx)
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const [aiGradingIds, setAiGradingIds] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<Record<string, string>>({});
  /** Skor saran AI, disimpan terpisah dari manualScores supaya admin bisa melihat
      angka asli dari AI walau ia sudah menimpanya dengan nilai sendiri. */
  const [aiScores, setAiScores] = useState<Record<string, number>>({});
  /** Sedang menilai seluruh essay peserta ini sekaligus. */
  const [menilaiBorongan, setMenilaiBorongan] = useState(false);
  /*
    Pengaturan penilai dipegang di layar ini, bukan hanya di Admin Panel.

    Mengganti model adalah hal yang dilakukan JUSTRU saat menilai - biasanya
    setelah melihat pesan "jatah habis" atau hasil yang meleset. Menyuruh orang
    keluar ke Admin Panel pada saat itu berarti meninggalkan daftar jawaban yang
    sedang dikerjakan, lalu mencari jalan kembali ke peserta yang sama.

    Yang TIDAK ikut pindah ke sini: tokennya. Ia tidak punya alasan muncul di
    layar penilaian, dan layar ini bisa dibuka orang yang bukan pengurus.
  */
  const [setelanPenilai, setSetelanPenilai] = useState<PengaturanPenilai>(PENILAI_BAWAAN);
  const [daftarModel, setDaftarModel] = useState<ModelAI[]>([]);
  const [galatModel, setGalatModel] = useState('');
  const bolehAturModel = isAdminView && hasFullAccess(getSession<User>() ?? {});

  useEffect(() => {
    // Kalau gagal, penilaian otomatis tetap mati - itu sisi yang aman.
    ambilPengaturanPenilai().then(setSetelanPenilai).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bolehAturModel) return;
    /*
      Daftarnya ditanyakan ke Google, bukan ditulis di kode. Nama model berbeda
      antar kunci dan antar wilayah, dan diganti tanpa pemberitahuan - daftar
      tertutup di kode akan menawarkan nama yang tidak ada, dan kekeliruannya
      baru ketahuan saat tombol Nilai ditekan.
    */
    ambilDaftarModel('penilai')
      .then(m => { setDaftarModel(m); setGalatModel(''); })
      .catch(e => setGalatModel(e instanceof Error ? e.message : 'Gagal membaca daftar model.'));
  }, [bolehAturModel]);

  const penilaiOtomatis = setelanPenilai.otomatis;

  /** Simpan model pilihan sebagai bawaan baru - berlaku untuk penilai berikutnya juga. */
  const gantiModel = async (model: string) => {
    const bersih = model.trim();
    if (!bersih || bersih === setelanPenilai.model) return;
    const baru = { ...setelanPenilai, model: bersih };
    setSetelanPenilai(baru);                       // tampak seketika
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
      .then(({ data }: { data: any[] | null }) => {
        const rows = data ?? [];
        setAttempts(rows);
        if (autoOpenAttemptId) {
          const target = rows.find((a: any) => a.id === autoOpenAttemptId);
          if (target) handleViewDetail(target);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, autoOpenAttemptId]);

  const handleViewDetail = async (attempt: any) => {
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
    const orderedQs = questionIds.map((id: string) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean) as Question[];
    setQuestions(orderedQs);
    setAnswerDetails(ans ?? []);
    const scoreMap: Record<string, string> = {};
    const feedbackMap: Record<string, string> = {};
    const aiScoreMap: Record<string, number> = {};
    (ans ?? []).forEach((a: any) => {
      const adaManual = a.manual_score !== null && a.manual_score !== undefined;
      const adaAi     = a.ai_score !== null && a.ai_score !== undefined;
      if (a.ai_feedback) feedbackMap[a.question_id] = a.ai_feedback;
      if (adaAi) aiScoreMap[a.question_id] = Number(a.ai_score);
      // Nilai admin selalu menang. Kalau belum ada, skor AI yang tersimpan
      // dipakai sebagai isian awal sekaligus penanda bahwa soal ini tidak perlu
      // dinilai AI ulang.
      if (adaManual)      scoreMap[a.question_id] = String(a.manual_score);
      else if (adaAi)     scoreMap[a.question_id] = String(a.ai_score);
    });
    setManualScores(scoreMap);
    setAiFeedback(feedbackMap);
    setAiScores(aiScoreMap);
    setLoadingDetail(false);

    /*
      Penilaian otomatis saat halaman dibuka sekarang HARUS dinyalakan dulu.

      Dulu ini berjalan selalu, dan satu panggilan AI ditembakkan per soal
      essay. Membuka satu peserta berisi 5 essay berarti 5 permintaan - jadi
      sekadar MELIHAT jawaban orang menghabiskan jatah, bahkan ketika
      penilainya sudah tahu nilainya dan cuma ingin membacanya. Dengan jatah
      harian gratis yang hanya puluhan permintaan, beberapa kali buka-tutup
      halaman sudah cukup menghabiskannya - dan itu persis yang terjadi.

      Kalaupun dinyalakan, sekarang seluruh essay dinilai dalam SATU panggilan,
      bukan satu per soal.
    */
    if (isAdminView && penilaiOtomatis) {
      const belum = orderedQs
        .filter(q => q.question_type === 'essay')
        .filter(q => scoreMap[q.id] === undefined && !feedbackMap[q.id])
        .map(q => ({ q, teks: (ans ?? []).find((x: any) => x.question_id === q.id)?.essay_text?.trim() }))
        .filter((x): x is { q: Question; teks: string } => !!x.teks);
      if (belum.length > 0) void nilaiBorongan(attempt.id, belum.map(x => x.q), ans ?? []);
    }
  };

  /*
    Nilai SELURUH essay satu peserta dalam satu panggilan.

    Satu peserta 5 essay: 5 permintaan jadi 1. Satu sesi 30 peserta: 150 jadi
    30. Itu bukan penghematan yang enak dimiliki - jatah harian gratis Gemini
    2.5 Flash hanya puluhan permintaan, jadi bentuk lama memang tidak pernah
    bisa menyelesaikan satu sesi pun.

    Kegagalan AI tidak pernah menghalangi penilaian manual; itu tetap berlaku.
  */
  const nilaiBorongan = async (attemptId: string, daftarSoal: Question[], jawaban: any[]) => {
    const bahan: SoalDinilai[] = daftarSoal
      .filter(q => q.question_type === 'essay')
      .map(q => ({
        id: q.id,
        question: q.question,
        modelAnswer: q.model_answer,
        studentAnswer: (jawaban.find((x: any) => x.question_id === q.id)?.essay_text ?? '').trim(),
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
      // Tidak menimpa nilai yang sudah diketik penilai sambil menunggu.
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

      /*
        Soal yang tidak terjawab AI ditandai, bukan didiamkan. Membiarkannya
        kosong membuatnya tampak sama dengan soal yang memang belum giliran
        dinilai, dan penilai akan menunggu sesuatu yang tidak akan datang.
      */
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

  /** Best-effort - kegagalan AI TIDAK PERNAH menghalangi penilaian manual. */
  const runAiGrading = async (attemptId: string, q: Question, studentText: string) => {
    setAiGradingIds(p => new Set(p).add(q.id));
    setAiError(p => { const n = { ...p }; delete n[q.id]; return n; });
    try {
      const result = await gradeEssayWithAI(q.question, q.model_answer, studentText);
      setAiFeedback(p => ({ ...p, [q.id]: result.feedback }));
      setAiScores(p => ({ ...p, [q.id]: result.score }));
      // Jangan timpa kalau admin sudah sempat mengetik nilai sendiri sambil menunggu AI.
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
    await supabase.from('lc_quiz_attempts').update({
      score: finalScore, passed, total_correct: totalCorrect, total_questions: questions.length,
      grading_status: 'graded', graded_by: grader?.id ?? null, graded_at: new Date().toISOString(),
    }).eq('id', selectedAttempt.id);
    setSavingGrade(false);
    setSelectedAttempt((p: any) => p && ({ ...p, score: finalScore, passed, grading_status: 'graded' }));
    setDialog({ type: 'success', message: 'Nilai essay berhasil disimpan!' });
  };

  const getAnswerFor = (questionId: string) => answerDetails.find(a => a.question_id === questionId);

  if (selectedAttempt) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
          style={{ background: '#ffffff' }}>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">📋 Review Jawaban — {user.full_name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{selectedAttempt.lc_quiz_sessions?.session_name}</p>
          </div>
          <button onClick={() => setSelectedAttempt(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">← Kembali</button>
        </div>

        {/*
          Bilah penilai AI - menempel di bawah judul yang juga sticky.

          Mengganti model adalah hal yang dilakukan JUSTRU saat menilai:
          biasanya setelah melihat "jatah habis" atau hasil yang meleset.
          Menyuruh orang keluar ke Admin Panel pada saat itu berarti
          meninggalkan daftar jawaban yang sedang dikerjakan, lalu mencari jalan
          kembali ke peserta yang sama.

          Hanya muncul untuk yang boleh membuka Admin Panel - layar ini bisa
          dibuka penilai yang bukan pengurus, dan model yang dipakai bersama
          bukan miliknya untuk diubah.
        */}
        {bolehAturModel && questions.some(q => q.question_type === 'essay') && (
          <div className="flex items-center gap-2 flex-wrap px-4 sm:px-8 py-2 border-b sticky top-[64px] sm:top-[84px] z-10"
            style={{ background: '#faf7ff', borderColor: '#ede9fe' }}>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 whitespace-nowrap">
              Penilai AI
            </span>

            {daftarModel.length > 0 ? (
              <select value={setelanPenilai.model} onChange={e => gantiModel(e.target.value)}
                aria-label="Model AI penilai"
                className="text-xs font-semibold text-indigo-800 bg-white border border-violet-200 rounded-lg px-2 py-1.5 max-w-[260px] outline-none focus:border-violet-400">
                {/*
                  Model tersimpan yang TIDAK ada di daftar tetap ditampilkan.
                  Tanpa ini, model yang sudah dihentikan Google diam-diam
                  tergantikan oleh baris pertama daftar - dan pemakainya mengira
                  itulah yang selama ini terpakai.
                */}
                {!daftarModel.some(m => m.id === setelanPenilai.model) && (
                  <option value={setelanPenilai.model}>{setelanPenilai.model} — tidak ada di daftar</option>
                )}
                {daftarModel.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
            ) : galatModel ? (
              /*
                Daftar gagal dimuat - baru di sinilah isian ketik manual muncul.
                Bukan sebagai jalur utama: mengetik nama model adalah cara paling
                mudah salah, dan salahnya baru ketahuan saat tombol Nilai ditekan.
                Tapi tanpa jalan apa pun, kunci yang bermasalah membuat penilaian
                terkunci pada model yang mungkin justru sedang habis jatahnya.
              */
              <>
                <input defaultValue={setelanPenilai.model}
                  onBlur={e => gantiModel(e.target.value)}
                  aria-label="Nama model AI penilai"
                  className="text-xs font-semibold text-indigo-800 bg-white border border-amber-300 rounded-lg px-2 py-1.5 w-[220px] outline-none focus:border-violet-400" />
                <span className="text-[10px] text-amber-700 max-w-[380px] leading-snug">
                  Daftar model tidak bisa dibaca ({galatModel}) — ketik nama modelnya.
                </span>
              </>
            ) : (
              <span className="text-[11px] text-violet-400">memuat daftar model…</span>
            )}

            <label className="flex items-center gap-1.5 cursor-pointer ml-1">
              <input type="checkbox" checked={setelanPenilai.otomatis}
                onChange={async e => {
                  const baru = { ...setelanPenilai, otomatis: e.target.checked };
                  setSetelanPenilai(baru);
                  await simpanPengaturanPenilai(baru);
                }}
                className="w-3.5 h-3.5 rounded accent-violet-600" />
              <span className="text-[11px] font-semibold text-violet-700 whitespace-nowrap">Nilai otomatis</span>
            </label>

            <span className="flex-1 min-w-[4px]" />
            <span className="text-[10px] text-violet-400 whitespace-nowrap">
              tersimpan sebagai bawaan
            </span>
          </div>
        )}

        <div className="p-4 sm:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { label: 'Skor', value: selectedAttempt.grading_status === 'pending_review' ? '⏳' : (selectedAttempt.score?.toFixed(0) ?? '—'), color: selectedAttempt.grading_status === 'pending_review' ? 'from-amber-500 to-amber-600' : (selectedAttempt.score ?? 0) >= (selectedAttempt.lc_quiz_sessions?.passing_grade ?? 70) ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
              { label: 'Benar', value: `${selectedAttempt.total_correct}/${selectedAttempt.total_questions}`, color: 'from-blue-500 to-blue-600' },
              { label: 'Status', value: selectedAttempt.grading_status === 'pending_review' ? 'MENUNGGU' : (selectedAttempt.passed ? 'LULUS' : 'TIDAK LULUS'), color: selectedAttempt.grading_status === 'pending_review' ? 'from-amber-500 to-amber-600' : selectedAttempt.passed ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
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
                if (q.question_type === 'essay') {
                  // Latar SOLID: halaman Learning Center memakai foto sebagai latar, dan
                  // kartu semi-transparan (bg-indigo-50/40) membuat foto itu tembus ke
                  // belakang teks soal - pertanyaan & jawaban jadi sulit dibaca justru
                  // saat admin perlu membacanya untuk menilai.
                  return (
                    <div key={q.id} className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white bg-indigo-500">📝</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1} · Essay · <span className={`${DIFF_COLOR[q.difficulty].split(' ')[1]}`}>{q.difficulty}</span></p>
                          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                        </div>
                      </div>
                      <div className="ml-10 space-y-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jawaban Peserta</p>
                          {ans?.answer_thumb_url ? (
                            /*
                              Yang dimuat daftar ini PRATINJAU-nya, bukan gambar
                              penuh. Satu sesi bisa berisi puluhan jawaban; kalau
                              masing-masing memuat berkas 250 KB hanya untuk
                              ditampilkan sebesar perangko, satu kali buka daftar
                              sudah menghabiskan berpuluh megabyte - dan itu
                              terulang tiap kali halamannya dibuka. Gambar penuh
                              baru diunduh ketika penilai benar-benar mengkliknya.
                            */
                            <a href={ans.answer_image_url ?? ans.answer_thumb_url}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-block group" title="Klik untuk membuka gambar ukuran penuh">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ans.answer_thumb_url} alt="Jawaban bergambar peserta"
                                loading="lazy"
                                className="w-40 h-40 object-cover rounded-lg border border-slate-200 group-hover:border-slate-400 transition-all" />
                              <span className="block text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 mt-1">
                                🔍 Buka ukuran penuh
                              </span>
                            </a>
                          ) : (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ans?.essay_text?.trim() || <span className="italic text-slate-400">Tidak dijawab</span>}</p>
                          )}
                        </div>
                        {q.model_answer && (
                          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Kunci Referensi (untuk admin)</p>
                            <p className="text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">{q.model_answer}</p>
                          </div>
                        )}
                        {isAdminView ? (
                          <div className="space-y-2">
                            {aiGradingIds.has(q.id) && (
                              <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
                                <span className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                                🤖 AI sedang menilai...
                              </div>
                            )}
                            {aiFeedback[q.id] && (
                              <div className="bg-violet-50 rounded-xl border border-violet-200 p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">🤖 Saran AI — jawaban peserta vs kunci referensi</p>
                                  {aiScores[q.id] !== undefined && (
                                    <span className="text-[11px] font-black text-violet-700 bg-violet-100 border border-violet-300 rounded-full px-2 py-0.5 whitespace-nowrap">
                                      AI: {aiScores[q.id]}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-violet-800 leading-relaxed">{aiFeedback[q.id]}</p>
                                {/* Terlihat jelas kalau admin memberi keringanan/koreksi — angka
                                    AI tetap ditampilkan apa adanya di sebelah nilai akhir. */}
                                {aiScores[q.id] !== undefined && manualScores[q.id] !== undefined
                                  && manualScores[q.id] !== '' && Number(manualScores[q.id]) !== aiScores[q.id] && (
                                  <p className="text-[11px] font-semibold text-amber-700 mt-1.5">
                                    ✏️ Dikoreksi admin: {aiScores[q.id]} → {manualScores[q.id]}
                                  </p>
                                )}
                              </div>
                            )}
                            {aiError[q.id] && (
                              <p className="text-xs text-rose-500 italic">⚠️ {aiError[q.id]} — isi nilai manual di bawah.</p>
                            )}
                            {/* Tanpa keterangan ini, admin melihat kolom nilai kosong tanpa
                                saran AI dan tidak tahu apakah AI-nya rusak atau memang tidak
                                ada yang bisa dinilai. */}
                            {!ans?.essay_text?.trim() && !ans?.answer_thumb_url && (
                              <p className="text-xs text-slate-500 italic">
                                🤖 Penilaian AI dilewati — peserta tidak menuliskan jawaban untuk soal ini. Isi nilai manual bila perlu.
                              </p>
                            )}
                            {/* Jawaban bergambar dinilai manusia. AI di sini hanya
                                membandingkan TEKS dengan kunci referensi - ia tidak
                                melihat gambarnya sama sekali, jadi nilai apa pun yang
                                ia berikan akan menyesatkan. */}
                            {ans?.answer_thumb_url && (
                              <p className="text-xs text-slate-500 italic">
                                🖐️ Jawaban berupa gambar — dinilai manual. Buka gambarnya di atas, lalu isi nilai di bawah.
                              </p>
                            )}
                            <div className="flex items-center gap-3">
                              <label className="text-xs font-bold text-slate-600">Nilai (0-100):</label>
                              <input type="number" min={0} max={100}
                                value={manualScores[q.id] ?? ''}
                                onChange={e => setManualScores(p => ({ ...p, [q.id]: e.target.value }))}
                                className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-indigo-400" />
                              {ans?.essay_text?.trim() && (
                                <button type="button" disabled={aiGradingIds.has(q.id)}
                                  onClick={() => runAiGrading(selectedAttempt.id, q, ans.essay_text.trim())}
                                  className="text-[11px] font-bold text-violet-600 hover:text-violet-800 disabled:opacity-40 transition-colors">
                                  🔄 {aiFeedback[q.id] || aiError[q.id] ? 'Nilai Ulang dengan AI' : 'Nilai dengan AI'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          manualScores[q.id] !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600">Nilai:</span>
                              <span className="text-sm font-black text-indigo-700">{manualScores[q.id]}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                }
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
              {/* pr-14 pada tombol simpan: memberi jarak dari tombol melayang "Jelajahi
                  Platform" di tepi kanan-bawah, supaya tombol simpan tidak tertutup. */}
              {isAdminView && questions.some(q => q.question_type === 'essay') && (
                <div className="sticky bottom-4 flex justify-end items-center gap-2 pr-14">
                  {/*
                    Satu tombol untuk SELURUH essay peserta ini - satu panggilan
                    AI, bukan satu per soal. Sengaja diletakkan bersebelahan
                    dengan Simpan Nilai karena urutan kerjanya memang begitu:
                    minta saran, periksa, lalu simpan. Penilaian tetap bisa
                    diselesaikan tanpa menekannya sama sekali.
                  */}
                  <button type="button" disabled={menilaiBorongan || savingGrade}
                    onClick={() => selectedAttempt && nilaiBorongan(selectedAttempt.id, questions, answerDetails)}
                    title="Menilai semua jawaban essay peserta ini dalam satu permintaan ke AI"
                    className="px-4 py-3 bg-white hover:bg-violet-50 text-violet-700 text-sm font-bold rounded-xl shadow-lg border border-violet-200 transition-all disabled:opacity-60 flex items-center gap-2">
                    {menilaiBorongan
                      ? <><span className="w-4 h-4 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />Menilai...</>
                      : <>🤖 Nilai Semua Essay</>}
                  </button>
                  <button onClick={handleSaveManualGrade} disabled={savingGrade}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-60 flex items-center gap-2">
                    {savingGrade ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</> : '💾 Simpan Nilai Essay'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">{isAdminView ? `👁️ Jawaban — ${user.full_name}` : '📋 Lihat Jawaban Saya'}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pilih quiz untuk melihat detail jawaban</p>
        </div>
        <button onClick={onBack} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">← Kembali</button>
      </div>
      <div className="p-4 sm:p-8 space-y-4">
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
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.grading_status === 'pending_review' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
              {a.grading_status === 'pending_review' ? '⏳' : (a.score?.toFixed(0) ?? '—')}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
              <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                {a.grading_status === 'pending_review' ? <span>📝 {a.total_questions} soal essay dikirim</span> : <span>✅ {a.total_correct}/{a.total_questions} benar</span>}
                <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                <span>📅 {a.submitted_at ? fmtDate(a.submitted_at) : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <GradingStatusBadge attempt={a} />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">👥 Team</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Daftar anggota team & partisipasi quiz</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari anggota..." />
      </div>
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"
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
                <tr><td colSpan={6} className="p-0">
                  <ListEmptyState
                    adaFilterAktif={search.trim() !== ''}
                    onReset={() => setSearch('')}
                    icon="👥"
                    judulKosong="Belum ada data anggota"
                    deskripsiKosong="Nilai quiz anggota tim akan muncul di sini setelah mereka mengerjakan."
                  />
                </td></tr>
              )}
              {filtered.map(u => {
                const ua = attempts.filter((a: any) => a.user_id === u.id);
                const gradedUa = ua.filter((a: any) => (a as any).grading_status !== 'pending_review');
                const pendingCount = ua.length - gradedUa.length;
                const avg = gradedUa.length ? gradedUa.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / gradedUa.length : null;
                const passed = gradedUa.filter((a: any) => a.passed).length;
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
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                      {ua.length}
                      {pendingCount > 0 && <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⏳ {pendingCount}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {avg !== null ? <span className={`font-bold ${avg >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>{avg.toFixed(1)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {gradedUa.length ? <span className="text-xs font-bold text-indigo-600">{Math.round(passed/gradedUa.length*100)}%</span> : <span className="text-slate-300">—</span>}
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
