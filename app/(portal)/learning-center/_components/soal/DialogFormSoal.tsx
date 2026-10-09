'use client';

/** DialogFormSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Material } from '../shared';

export interface DialogFormSoalProps {
  handleAddManual: () => Promise<void>;
  materials: Material[];
  modeGrup: boolean;
  newQ: { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string; difficulty: "easy" | "medium" | "hard"; material_id: string; batch_name: string; question_type: "abcd" | "essay"; model_answer: string; answer_format: "text" | "image"; };
  setNewQ: import("react").Dispatch<import("react").SetStateAction<{ question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string; difficulty: "easy" | "medium" | "hard"; material_id: string; batch_name: string; question_type: "abcd" | "essay"; model_answer: string; answer_format: "text" | "image"; }>>;
  tutupTambahManual: () => void;
  viewMaterials: Material[];
}

export function DialogFormSoal({ handleAddManual, materials, modeGrup, newQ, setNewQ, tutupTambahManual, viewMaterials }: DialogFormSoalProps) {
  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4">
        <div className="rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-full overflow-y-auto" style={{ background: '#ffffff' }}>
          <h3 className="font-bold text-slate-800 mb-1 text-base sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-5 px-5 py-2.5 border-b border-slate-100">
            {modeGrup ? '➕ Tambah Soal ke Grup' : '➕ Tambah Soal Manual'}
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            {newQ.question_type === 'essay' ? 'Isi pertanyaan essay dan (opsional) kunci jawaban referensi untuk membantu penilaian manual nanti.' : 'Isi semua field, klik tombol "✓ Benar" untuk menandai jawaban yang benar.'}
          </p>
          {/*
            Tujuan penyimpanannya dibaca dari isian yang berlaku SEKARANG, bukan
            dari grup yang tadi diklik. Kedua isian di bawah tetap bisa diubah,
            dan keterangan yang membeku pada nilai awal akan menyebut grup yang
            bukan tempat soalnya benar-benar mendarat.
          */}
          {modeGrup && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mb-0.5">Disimpan ke</p>
              <p className="text-[13px] text-emerald-900 leading-snug">
                <span className="font-bold">
                  {materials.find(m => m.id === newQ.material_id)?.materi_name ?? '— materi belum dipilih —'}
                </span>
                {' · '}
                {newQ.batch_name.trim()
                  ? <span className="font-bold"><Ikon nama="📌" ukuran="1em" className="inline-block align-[-0.12em]" /> {newQ.batch_name}</span>
                  : <span className="italic">Tanpa Grup</span>}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                Form tetap terbuka setelah disimpan, jadi soal berikutnya bisa langsung diketik.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest mr-1">Tipe Soal</span>
            {(['abcd', 'essay'] as const).map(t => (
              <button key={t} type="button" onClick={() => setNewQ(p => ({ ...p, question_type: t }))}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${newQ.question_type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-emerald-50'}`}>
                {t === 'abcd' ? '🔤 Pilihan Ganda (ABCD)' : '📝 Essay'}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="f-learning-center-components-questionspage-7" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
              <select id="f-learning-center-components-questionspage-7" value={newQ.material_id} onChange={e => setNewQ(p => ({ ...p, material_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                <option value="">-- Pilih Materi --</option>
                {(viewMaterials.length > 0 ? viewMaterials : materials).map(m =>
                  <option key={m.id} value={m.id}>{m.materi_name}</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="f-learning-center-components-questionspage-8" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Pertanyaan *</label>
              <textarea id="f-learning-center-components-questionspage-8" value={newQ.question} onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 resize-none"
                placeholder="Tulis pertanyaan di sini..." />
            </div>
            {newQ.question_type === 'essay' ? (
              <>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Bentuk Jawaban Peserta
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'text',  ikon: '⌨️', judul: 'Diketik',      ket: 'Peserta mengetik jawabannya' },
                    { v: 'image', ikon: '📷', judul: 'Foto Gambar', ket: 'Digambar di kertas lalu difoto' },
                  ] as const).map(o => {
                    const aktif = (newQ.answer_format ?? 'text') === o.v;
                    return (
                      <button key={o.v} type="button"
                        onClick={() => setNewQ(p => ({ ...p, answer_format: o.v }))}
                        className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                          aktif ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                                : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                        <div className="text-sm font-bold text-slate-700"><Ikon nama={o.ikon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.judul}</div>
                        <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{o.ket}</div>
                      </button>
                    );
                  })}
                </div>
                {(newQ.answer_format ?? 'text') === 'image' && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed">
                    Peserta akan diminta mengunggah foto. Fotonya dikecilkan di perangkat peserta
                    sebelum dikirim, jadi tidak memberatkan kuota — foto 5 MB dari kamera ponsel
                    menjadi sekitar 250 KB.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="f-learning-center-components-questionspage-9" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Kunci / Referensi Jawaban
                  <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional — hanya untuk bantu admin menilai, tidak dilihat peserta</span>
                </label>
                <textarea id="f-learning-center-components-questionspage-9" value={newQ.model_answer} onChange={e => setNewQ(p => ({ ...p, model_answer: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 resize-none"
                  placeholder="Contoh jawaban ideal / poin-poin kunci penilaian..." />
              </div>
              </>
            ) : (['a', 'b', 'c', 'd'] as const).map(opt => (
              <div key={opt} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${newQ.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{opt.toUpperCase()}</span>
                <input value={(newQ as any)[`option_${opt}`]} onChange={e => setNewQ(p => ({ ...p, [`option_${opt}`]: e.target.value }))}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  placeholder={`Pilihan ${opt.toUpperCase()}`} />
                <button onClick={() => setNewQ(p => ({ ...p, correct_answer: opt.toUpperCase() }))}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${newQ.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50 border border-transparent'}`}>
                  ✓ Benar
                </button>
              </div>
            ))}
            <div>
              <label htmlFor="f-learning-center-components-questionspage-10" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                Nama Grup / Batch
                <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional</span>
              </label>
              <input id="f-learning-center-components-questionspage-10" value={newQ.batch_name} onChange={e => setNewQ(p => ({ ...p, batch_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                placeholder="contoh: Instalasi Dasar, Quiz Minggu 1, Troubleshooting..." />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-questionspage-11" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
              <select id="f-learning-center-components-questionspage-11" value={newQ.difficulty} onChange={e => setNewQ(p => ({ ...p, difficulty: e.target.value as any }))}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleAddManual}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all">
              <IkonTeks nama="💾" />Simpan Soal
            </button>
            <button onClick={tutupTambahManual}
              className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">
              {modeGrup ? 'Selesai' : 'Batal'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
