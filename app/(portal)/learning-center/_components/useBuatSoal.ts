'use client';

/** useBuatSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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

      // Robust JSON extraction
      // 1. Strip all markdown code fences (```json, ```javascript, ```, etc.)
      const cleanText = text
        .replace(/```[\w]*\n?/gi, '')  // opening fence with optional lang tag
        .replace(/```/g, '')            // any remaining closing fences
        .trim();

      // 2. Try regex match for JSON array first
      let jsonMatch = cleanText.match(/\[[\s\S]*\]/);

      // 3. Fallback: manually find outermost [ ... ] brackets
      if (!jsonMatch) {
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonMatch = [cleanText.slice(firstBracket, lastBracket + 1)];
        }
      }

      // 4. Last fallback: try parsing the entire cleaned text directly
      if (!jsonMatch) {
        try {
          const direct = JSON.parse(cleanText);
          if (Array.isArray(direct)) jsonMatch = [cleanText];
        } catch { /* ignore */ }
      }

      if (!jsonMatch) {
        // Show first 300 chars of raw response for debugging
        const preview = text.slice(0, 300).replace(/\n/g, ' ');
        throw new Error(`Format JSON tidak ditemukan. Response Gemini: "${preview}..."`);
      }

      const parsed: any[] = JSON.parse(jsonMatch[0]);
      //  answer_format DISERTAKAN eksplisit di kedua cabang - kolomnya NOT
      //  NULL dengan default 'text', tapi INSERT banyak baris sekaligus lewat
      //  PostgREST menyamakan daftar kolom lintas SEMUA baris dalam satu
      //  panggilan; baris yang tidak menyebut kolom ini bisa berakhir NULL
      //  eksplisit alih-alih memakai default-nya begitu baris lain (mis. dari
      //  sesi banding yang mencampur genType) menyebutnya. Ditulis 'text'
      //  di sini menghilangkan ambiguitasnya sama sekali.
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

  /** Simpan baris hasil AI ke database. Dipakai mode biasa maupun pemenang banding. */
  const simpanHasil = async (rows: Record<string, unknown>[]) => {
    try {
      setGenerating(true);
      setGenStatus('💾 Menyimpan soal ke database...');
      /*
        Nomor urut diberikan mengikuti urutan keluaran AI, disambung dari nomor
        terakhir di grup itu.

        Ini bukan sekadar kerapian. Satu angkatan generate disisipkan dalam SATU
        perintah, jadi created_at seluruh barisnya sama persis - tanpa nomor,
        urutan tampilnya tidak tertentu dan bisa berubah tiap kali daftarnya
        dimuat. Soal nomor 1 yang dirancang sebagai pembuka bisa muncul di
        tengah, dan tidak ada yang bisa dipakai untuk membetulkannya.
      */
      const nomorMulai = kolomUrutanAda
        ? nomorBerikutnya(questions.filter(q => q.material_id === selectedMat
            && (q.batch_name ?? '') === batchName.trim())) - 1
        : 0;
      const barisFinal = kolomUrutanAda
        ? (rows as Record<string, unknown>[]).map((r, i) => ({ ...r, urutan: nomorMulai + i + 1 }))
        : rows;
      const { error } = await supabase.from('lc_questions').insert(barisFinal);
      if (error) throw error;
      // Track Gemini usage in localStorage
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

  /** Mode biasa: satu model, langsung disimpan - persis seperti sebelumnya. */
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

  /*
    Mode banding: materi yang sama, dua model, hasilnya berdampingan.

    Keduanya dijalankan BERSAMAAN, bukan berurutan - menunggu dua kali secara
    bergantian membuat orang menyerah sebelum melihat hasilnya. Dan keduanya
    dijalankan dengan prompt yang sama persis: kalau salah satunya diberi
    kelonggaran berbeda, yang dibandingkan bukan lagi modelnya.

    TIDAK ADA yang disimpan sampai satu sisi dipilih. Perbandingan yang
    menyimpan dua-duanya bukan perbandingan - itu cuma menggandakan soal.
  */
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
      // Satu sisi gagal bukan alasan membuang sisi yang berhasil - yang berhasil
      // tetap bisa dipakai, dan kegagalannya disebutkan apa adanya.
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
