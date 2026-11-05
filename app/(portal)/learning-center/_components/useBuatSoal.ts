'use client';

import type { SisiBanding } from './QuestionsPage';
import { supabase, User, Material, Question, generateWithGemini, DialogState } from './shared';
import { nomorBerikutnya } from '@/lib/urutan-soal';

export interface BuatSoalKonteks {
  batchName: string;
  genCount: number;
  genDiff: "easy" | "medium" | "hard" | "mixed";
  genExtraPrompt: string;
  genType: "abcd" | "essay";
  kolomUrutanAda: boolean;
  load: () => Promise<void>;
  materials: Material[];
  modelBandingA: string;
  modelBandingB: string;
  pdfFile: File | null;
  pdfRef: import("react").RefObject<HTMLInputElement | null>;
  questions: Question[];
  selectedMat: string;
  setBatchName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setGenExtraPrompt: import("react").Dispatch<import("react").SetStateAction<string>>;
  setGenStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setGenerating: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setHasilBanding: import("react").Dispatch<import("react").SetStateAction<{ a: SisiBanding; b: SisiBanding; } | null>>;
  setPdfFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setShowGenerate: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  user: User;
}

export function useBuatSoal(k: BuatSoalKonteks) {
  const { batchName, genCount, genDiff, genExtraPrompt, genType, kolomUrutanAda, load, materials, modelBandingA, modelBandingB, pdfFile, pdfRef, questions, selectedMat, setBatchName, setDialog, setGenExtraPrompt, setGenStatus, setGenerating, setHasilBanding, setPdfFile, setShowGenerate, user } = k;
  const hasilkanSoal = async (modelPaksa?: string): Promise<Record<string, unknown>[]> => {
    if (!selectedMat) throw new Error('Pilih materi terlebih dahulu!');
    const mat = materials.find(m => m.id === selectedMat);
    if (!pdfFile && !mat?.content_text) throw new Error('Upload PDF materi atau pastikan materi sudah punya konten teks.');
      const diffInstruction = genDiff === 'mixed'
        ? 'Buat soal dengan campuran tingkat kesulitan: easy, medium, dan hard secara merata.'
        : `Semua soal tingkat kesulitan: ${genDiff}.`;
      const extraInstruction = genExtraPrompt.trim()
        ? `\n\nFOKUS TOPIK KHUSUS: ${genExtraPrompt.trim()}\nPastikan seluruh soal yang dibuat berfokus pada topik tersebut dari materi ini.`
        : '';
      const prompt = genType === 'essay'
        ? `Kamu adalah instruktur training profesional. ${pdfFile ? 'Berdasarkan dokumen PDF yang dilampirkan' : 'Berdasarkan materi berikut'}, buat tepat ${genCount} soal essay (uraian, bukan pilihan ganda) dalam Bahasa Indonesia yang menuntut jawaban penjelasan/analisis, bukan sekadar satu kata.\n${diffInstruction}${extraInstruction}\n${!pdfFile && mat?.content_text ? `\nMATERI:\n${mat.content_text.slice(0, 30000)}` : ''}\n\nOUTPUT RULE: Balas HANYA dengan JSON array murni. Tidak boleh ada teks, penjelasan, atau markdown di luar array. Mulai langsung dengan [ dan akhiri dengan ].\n[\n  {\n    "question": "Pertanyaan essay lengkap?",\n    "model_answer": "Contoh/kunci jawaban ideal sebagai referensi penilaian manual admin",\n    "difficulty": "easy"\n  }\n]`
        : `Kamu adalah instruktur training profesional. ${pdfFile ? 'Berdasarkan dokumen PDF yang dilampirkan' : 'Berdasarkan materi berikut'}, buat tepat ${genCount} soal pilihan ganda (A, B, C, D) dalam Bahasa Indonesia.\n${diffInstruction}${extraInstruction}\n${!pdfFile && mat?.content_text ? `\nMATERI:\n${mat.content_text.slice(0, 30000)}` : ''}\n\nOUTPUT RULE: Balas HANYA dengan JSON array murni. Tidak boleh ada teks, penjelasan, atau markdown di luar array. Mulai langsung dengan [ dan akhiri dengan ].\n[\n  {\n    "question": "Pertanyaan lengkap?",\n    "option_a": "Jawaban A",\n    "option_b": "Jawaban B",\n    "option_c": "Jawaban C",\n    "option_d": "Jawaban D",\n    "correct_answer": "A",\n    "difficulty": "easy"\n  }\n]`;
      setGenStatus(pdfFile ? '📄 Mengirim PDF ke Gemini...' : '🧠 Generating soal...');
      const text = await generateWithGemini(prompt, pdfFile ?? null, undefined, modelPaksa);
      setGenStatus('⚙️ Memproses hasil...');

      const cleanText = text
        .replace(/```[\w]*\n?/gi, '')
        .replace(/```/g, '')
        .trim();

      let jsonMatch = cleanText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonMatch = [cleanText.slice(firstBracket, lastBracket + 1)];
        }
      }

      if (!jsonMatch) {
        try {
          const direct = JSON.parse(cleanText);
          if (Array.isArray(direct)) jsonMatch = [cleanText];
        } catch {  }
      }

      if (!jsonMatch) {
        const preview = text.slice(0, 300).replace(/\n/g, ' ');
        throw new Error(`Format JSON tidak ditemukan. Response Gemini: "${preview}..."`);
      }

      const parsed: any[] = JSON.parse(jsonMatch[0]);
      const rows = genType === 'essay'
        ? parsed.map(q => ({
            material_id: selectedMat, materi_name: mat?.materi_name ?? '',
            batch_name: batchName.trim() || null,
            question: q.question, option_a: '', option_b: '', option_c: '', option_d: '',
            correct_answer: null, question_type: 'essay', model_answer: q.model_answer ?? '',
            answer_format: 'text',
            difficulty: q.difficulty ?? 'medium', created_by: user.id,
          }))
        : parsed.map(q => ({
            material_id: selectedMat, materi_name: mat?.materi_name ?? '',
            batch_name: batchName.trim() || null,
            question: q.question, option_a: q.option_a, option_b: q.option_b,
            option_c: q.option_c, option_d: q.option_d,
            correct_answer: (q.correct_answer ?? 'A').toUpperCase(), question_type: 'abcd',
            answer_format: 'text',
            difficulty: q.difficulty ?? 'medium', created_by: user.id,
          }));
    return rows as Record<string, unknown>[];
  };

  const simpanHasil = async (rows: Record<string, unknown>[]) => {
    try {
      setGenerating(true);
      setGenStatus('💾 Menyimpan soal ke database...');
      const nomorMulai = kolomUrutanAda
        ? nomorBerikutnya(questions.filter(q => q.material_id === selectedMat
            && (q.batch_name ?? '') === batchName.trim())) - 1
        : 0;
      const barisFinal = kolomUrutanAda
        ? (rows as Record<string, unknown>[]).map((r, i) => ({ ...r, urutan: nomorMulai + i + 1 }))
        : rows;
      const { error } = await supabase.from('lc_questions').insert(barisFinal);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `gemini_usage_${today}`;
      const current = parseInt(localStorage.getItem(storageKey) ?? '0');
      localStorage.setItem(storageKey, String(current + 1));
      localStorage.setItem('gemini_last_used', new Date().toISOString());
      setPdfFile(null);
      if (pdfRef.current) pdfRef.current.value = '';
      setBatchName(''); setGenExtraPrompt('');
      setShowGenerate(false); setGenStatus(''); setHasilBanding(null); load();
      setDialog({ type: 'success', title: 'Generate Selesai', message: `${rows.length} soal berhasil digenerate dan disimpan!${batchName.trim() ? ` (Batch: ${batchName.trim()})` : ''}` });
    } catch (err: any) {
      setDialog({ type: 'error', title: 'Gagal Menyimpan', message: err.message ?? String(err) });
      setGenStatus('');
    }
    setGenerating(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenStatus('Menghubungi Gemini AI...');
    try {
      const rows = await hasilkanSoal();
      await simpanHasil(rows);
    } catch (err: any) {
      setDialog({ type: 'error', title: 'Generate Gagal', message: 'Gagal generate: ' + (err.message ?? String(err)) });
      setGenStatus('');
      setGenerating(false);
    }
  };

  const handleBanding = async () => {
    const a = modelBandingA.trim();
    const b = modelBandingB.trim();
    if (!a || !b) { setDialog({ type: 'error', message: 'Pilih dua model dulu.' }); return; }
    if (a === b) { setDialog({ type: 'error', message: 'Pilih dua model yang BERBEDA - membandingkan model dengan dirinya sendiri tidak memberi tahu apa pun.' }); return; }

    setGenerating(true);
    setHasilBanding(null);
    setGenStatus(`Menjalankan ${a} dan ${b} bersamaan...`);
    try {
      const [ra, rb] = await Promise.allSettled([hasilkanSoal(a), hasilkanSoal(b)]);
      setGenStatus('');
      setGenerating(false);
      setHasilBanding({
        a: { model: a, rows: ra.status === 'fulfilled' ? ra.value : [], galat: ra.status === 'rejected' ? String(ra.reason?.message ?? ra.reason) : '' },
        b: { model: b, rows: rb.status === 'fulfilled' ? rb.value : [], galat: rb.status === 'rejected' ? String(rb.reason?.message ?? rb.reason) : '' },
      });
    } catch (err: any) {
      setGenStatus(''); setGenerating(false);
      setDialog({ type: 'error', title: 'Banding Gagal', message: err.message ?? String(err) });
    }
  };
  return { hasilkanSoal, simpanHasil, handleGenerate, handleBanding };
}
