'use client';

/** useKelolaSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase, User, Material, Question, DialogState } from './shared';
import { nomorBerikutnya } from '@/lib/urutan-soal';

export interface KelolaSoalKonteks {
  KOSONG_SOAL: { readonly question: ""; readonly option_a: ""; readonly option_b: ""; readonly option_c: ""; readonly option_d: ""; readonly correct_answer: "A"; readonly model_answer: ""; };
  editQ: Question | null;
  kolomUrutanAda: boolean;
  load: () => Promise<void>;
  materials: Material[];
  modeGrup: boolean;
  newQ: { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string; difficulty: "easy" | "medium" | "hard"; material_id: string; batch_name: string; question_type: "abcd" | "essay"; model_answer: string; answer_format: "text" | "image"; };
  questions: Question[];
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setEditQ: import("react").Dispatch<import("react").SetStateAction<Question | null>>;
  setNewQ: import("react").Dispatch<import("react").SetStateAction<{ question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string; difficulty: "easy" | "medium" | "hard"; material_id: string; batch_name: string; question_type: "abcd" | "essay"; model_answer: string; answer_format: "text" | "image"; }>>;
  setShowAddManual: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  user: User;
}

export function useKelolaSoal(k: KelolaSoalKonteks) {
  const { KOSONG_SOAL, editQ, kolomUrutanAda, load, materials, modeGrup, newQ, questions, setDialog, setEditQ, setNewQ, setShowAddManual, user } = k;
  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm', title: 'Hapus Soal',
      message: 'Soal ini akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        // Delete linked answers first (FK constraint)
        await supabase.from('lc_answers').delete().eq('question_id', id);
        const { error } = await supabase.from('lc_questions').delete().eq('id', id);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
        load();
      },
    });
  };

  const handleDeleteMatGroup = (matId: string, matName: string) => {
    const count = questions.filter(q => q.material_id === matId).length;
    setDialog({
      type: 'confirm', title: 'Hapus Semua Soal Materi',
      message: `Semua ${count} soal pada materi "${matName}" akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Hapus Semua',
      onConfirm: async () => {
        // Get question IDs first, delete answers, then questions
        const qIds = questions.filter(q => q.material_id === matId).map(q => q.id);
        if (qIds.length > 0) await supabase.from('lc_answers').delete().in('question_id', qIds);
        const { error } = await supabase.from('lc_questions').delete().eq('material_id', matId);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
        load();
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editQ) return;
    //  Diperiksa: soal yang gagal tersimpan diam-diam akan tampak
    //  ter-update di layar (setEditQ(null) menutup formnya) padahal
    //  peserta masih mengerjakan versi soal yang lama.
    const { data, error } = await supabase.from('lc_questions').update({
      question: editQ.question, option_a: editQ.option_a, option_b: editQ.option_b,
      option_c: editQ.option_c, option_d: editQ.option_d,
      correct_answer: editQ.correct_answer, difficulty: editQ.difficulty,
      model_answer: editQ.model_answer,
    }).eq('id', editQ.id).select('id');
    if (error || !data || data.length === 0) {
      setDialog({ type: 'error', message: 'Gagal menyimpan perubahan soal.' });
      return;
    }
    setEditQ(null); load();
  };

  const handleAddManual = async () => {
    if (!newQ.material_id) { setDialog({ type: 'error', message: 'Pilih materi terlebih dahulu!' }); return; }
    if (!newQ.question.trim()) { setDialog({ type: 'error', message: 'Pertanyaan wajib diisi!' }); return; }
    if (newQ.question_type !== 'essay' && (!newQ.option_a.trim() || !newQ.option_b.trim() || !newQ.option_c.trim() || !newQ.option_d.trim())) {
      setDialog({ type: 'error', message: 'Semua pilihan jawaban (A, B, C, D) wajib diisi!' }); return;
    }
    const mat = materials.find(m => m.id === newQ.material_id);
    const payload = newQ.question_type === 'essay'
      ? { question: newQ.question, material_id: newQ.material_id, batch_name: newQ.batch_name,
          difficulty: newQ.difficulty, question_type: 'essay', model_answer: newQ.model_answer,
          answer_format: newQ.answer_format ?? 'text',
          option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: null }
      //  answer_format tetap DITULIS 'text' walau tidak berarti apa-apa untuk
      //  soal abcd - kolomnya NOT NULL. Menyetelnya ke `undefined` (versi
      //  sebelumnya) TIDAK membuat PostgREST melewatkan kolom ini seperti
      //  dugaan semula: klien Supabase membangun daftar kolom insert dari
      //  Object.keys(objeknya), dan Object.keys() tetap menyertakan kunci
      //  yang nilainya undefined - PostgREST lalu mengirim NULL eksplisit
      //  untuk kolom yang "disebut tapi tidak diisi" itu, bukan memakai
      //  default tabelnya. Baris yang sama persis membuat generate-AI gagal
      //  (lihat simpanHasil), dan berlaku juga di sini walau cuma satu baris.
      : { ...newQ, question_type: 'abcd', answer_format: 'text' };
    /*
      Soal baru diberi nomor di EKOR grupnya. Tanpa ini ia masuk tanpa nomor,
      dan soal tanpa nomor jatuh ke pengurutan created_at - artinya begitu
      grupnya diatur ulang sekali, posisi soal-soal baru ikut bergeser tanpa
      ada yang menggesernya.
    */
    const nomorBaru = kolomUrutanAda
      ? nomorBerikutnya(questions.filter(q => q.material_id === newQ.material_id
          && (q.batch_name ?? '') === (newQ.batch_name ?? '')))
      : undefined;
    const { error } = await supabase.from('lc_questions').insert([{
      ...payload, materi_name: mat?.materi_name ?? '', created_by: user.id,
      ...(nomorBaru === undefined ? {} : { urutan: nomorBaru }),
    }]);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    if (modeGrup) {
      /*
        Form dibiarkan terbuka, dan hanya isi soalnya yang dikosongkan. Materi,
        grup, tipe, dan tingkat kesulitannya tetap - orang yang menambah satu
        soal ke sebuah grup hampir selalu menambah beberapa sekaligus, dan
        menutup form lalu memintanya memilih materi dan mengetik nama grup yang
        sama berulang kali adalah cara paling mudah melahirkan grup kembar
        akibat salah ketik.
      */
      setNewQ(p => ({ ...p, ...KOSONG_SOAL }));
    } else {
      setShowAddManual(false);
      setNewQ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', difficulty: 'medium', material_id: '', batch_name: '', question_type: 'abcd', model_answer: '', answer_format: 'text' });
    }
    load();
    setDialog({ type: 'success', message: 'Soal berhasil ditambahkan!' });
  };
  return { handleDelete, handleDeleteMatGroup, handleSaveEdit, handleAddManual };
}
