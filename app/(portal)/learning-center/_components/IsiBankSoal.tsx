'use client';

/** IsiBankSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { GridSubfolderSoal } from './soal/GridSubfolderSoal';
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { supabase, Material, Question, FolderNode, DialogState } from './shared';
import { GrupBatchSoal } from './soal/GrupBatchSoal';
import { UnggahGambarSoal } from './soal/UnggahGambarSoal';
import { FOLDER_COLORS } from './QuestionsPage';

export interface IsiBankSoalProps {
  buangDraf: (kunci: string) => void;
  bukaTambahDiGrup: (materialId: string, batchKey: string) => void;
  currentFolderNode: FolderNode | null;
  editQ: Question | null;
  expandedBatches: Set<string>;
  filteredQuestions: Question[];
  generatePanelJSX: import("react").JSX.Element;
  geserSoal: (kunci: string, grup: Question[], idx: number, arah: -1 | 1) => void;
  handleDelete: (id: string) => void;
  handleDeleteMatGroup: (matId: string, matName: string) => void;
  handleSaveEdit: () => Promise<void>;
  kolomUrutanAda: boolean;
  load: () => Promise<void>;
  menyimpanUrutan: string | null;
  questions: Question[];
  search: string;
  selectedMat: string;
  selectedSubFolder: string | null;
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setEditQ: import("react").Dispatch<import("react").SetStateAction<Question | null>>;
  setExpandedBatches: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setRenameFolder: import("react").Dispatch<import("react").SetStateAction<{ oldName: string; newName: string; } | null>>;
  setSelectedMat: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedSubFolder: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  showGenerate: boolean;
  simpanUrutan: (kunci: string, susunan: Question[]) => Promise<void>;
  subFolders: string[];
  susunanTampil: (kunci: string, grup: Question[]) => Question[];
  urutanDraf: Record<string, string[]>;
  viewMaterials: Material[];
}

export function IsiBankSoal({ buangDraf, bukaTambahDiGrup, currentFolderNode, editQ, expandedBatches, filteredQuestions, generatePanelJSX, geserSoal, handleDelete, handleDeleteMatGroup, handleSaveEdit, kolomUrutanAda, load, menyimpanUrutan, questions, search, selectedMat, selectedSubFolder, setDialog, setEditQ, setExpandedBatches, setRenameFolder, setSelectedMat, setSelectedSubFolder, showGenerate, simpanUrutan, subFolders, susunanTampil, urutanDraf, viewMaterials }: IsiBankSoalProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
        {showGenerate && generatePanelJSX}

        {/*
          Tombol pengatur urutan disembunyikan bila kolomnya belum ada, dan
          fitur yang hilang tanpa keterangan lebih membingungkan daripada
          fitur yang belum ada sama sekali - orang akan mencarinya, mengira
          dirinya salah lihat. Sebutkan apa yang kurang dan di mana
          membetulkannya.
        */}
        {questions.length > 0 && !kolomUrutanAda && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Pengaturan urutan soal belum aktif.</strong> Jalankan{' '}
              <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">sql/learning-center-urutan-soal.sql</code>{' '}
              di Supabase, lalu muat ulang halaman ini — tombol panah naik/turun akan muncul di tiap soal.
            </p>
          </div>
        )}

        {/* Subfolder grid */}
        <GridSubfolderSoal
          currentFolderNode={currentFolderNode} load={load} questions={questions} selectedSubFolder={selectedSubFolder} setDialog={setDialog} setRenameFolder={setRenameFolder} setSelectedSubFolder={setSelectedSubFolder} subFolders={subFolders}
        />

        {/* Material filter chips */}
        {viewMaterials.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
            <button
              onClick={() => setSelectedMat('')}
              className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
              style={selectedMat === ''
                ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: '1px solid #6366f1', boxShadow: '0 2px 6px rgba(99,102,241,0.35)' }
                : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
              Semua
            </button>
            {viewMaterials.map((m, i) => {
              const col = FOLDER_COLORS[i % FOLDER_COLORS.length];
              const active = selectedMat === m.id;
              return (
                <button key={m.id}
                  onClick={() => setSelectedMat(active ? '' : m.id)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
                  style={active
                    ? { background: col.gradient, color: '#fff', border: `1px solid ${col.icon}`, boxShadow: `0 2px 6px ${col.icon}40` }
                    : { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                  {m.materi_name}
                </button>
              );
            })}
          </div>
        )}

        {/* Edit Soal Modal */}
        {editQ && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4">
            <div className="rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-full overflow-y-auto" style={{ background: '#ffffff' }}>
              <h3 className="font-bold text-slate-800 mb-4 sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-5 px-5 py-2.5 border-b border-slate-100"><IkonTeks nama="✏" />Edit Soal</h3>
              <div className="space-y-3">
                <textarea value={editQ.question} onChange={e => setEditQ(p => p && ({ ...p, question: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Pertanyaan" />
                <UnggahGambarSoal url={editQ.gambar_url} ubah={u => setEditQ(p => p && ({ ...p, gambar_url: u || null }))} />
                {editQ.question_type === 'essay' ? (
                  <div>
                    <label htmlFor="f-learning-center-components-questionspage-12" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                      Kunci / Referensi Jawaban <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case">Optional</span>
                    </label>
                    <textarea id="f-learning-center-components-questionspage-12" value={editQ.model_answer ?? ''} onChange={e => setEditQ(p => p && ({ ...p, model_answer: e.target.value }))}
                      rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Contoh jawaban ideal..." />
                  </div>
                ) : (['a','b','c','d'] as const).map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{opt.toUpperCase()}</span>
                    <input aria-label={`Pilihan jawaban ${opt.toUpperCase()}`} value={(editQ as any)[`option_${opt}`]} onChange={e => setEditQ(p => p && ({ ...p, [`option_${opt}`]: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <button onClick={() => setEditQ(p => p && ({ ...p, correct_answer: opt.toUpperCase() as any }))}
                      className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50'}`}>
                      Benar
                    </button>
                  </div>
                ))}
                <select aria-label="Tingkat kesulitan" value={editQ.difficulty} onChange={e => setEditQ(p => p && ({ ...p, difficulty: e.target.value as any }))}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400">
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all">Simpan</button>
                <button onClick={() => setEditQ(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ─── Soal dikelompokkan per Materi ─── */}
        <div className="space-y-8">
          {filteredQuestions.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="text-center px-10 py-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                <div className="text-5xl mb-3"><Ikon nama="🧩" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                <p className="font-semibold text-slate-700">{search ? 'Tidak ada soal yang cocok' : 'Belum ada soal di folder ini'}</p>
                {!search && <p className="text-sm mt-1 text-slate-500">Generate soal dengan AI atau tambah soal manual</p>}
              </div>
            </div>
          )}
          {viewMaterials
            .map((mat, matIdx) => ({ mat, matIdx, qs: filteredQuestions.filter(q => q.material_id === mat.id) }))
            .filter(({ qs }) => qs.length > 0)
            .map(({ mat, matIdx, qs }) => {
              const totalForMat = questions.filter(q => q.material_id === mat.id).length;
              const matColor = FOLDER_COLORS[matIdx % FOLDER_COLORS.length];

              // Group questions by batch_name within this material
              const batchKeys = Array.from(new Set(qs.map(q => q.batch_name ?? '')))
                .sort((a, b) => {
                  if (a === '') return 1; // ungrouped goes last
                  if (b === '') return -1;
                  return a.localeCompare(b);
                });

              const handleDeleteBatch = (batchKey: string) => {
                const batchQs = qs.filter(q => (q.batch_name ?? '') === batchKey);
                const label = batchKey || 'Tanpa Grup';
                setDialog({
                  type: 'confirm', title: 'Hapus Grup Soal',
                  message: `Semua ${batchQs.length} soal dalam grup "${label}" akan dihapus permanen. Lanjutkan?`,
                  confirmLabel: 'Hapus',
                  onConfirm: async () => {
                    const ids = batchQs.map(q => q.id);
                    if (ids.length > 0) {
                      await supabase.from('lc_answers').delete().in('question_id', ids);
                      const { data: terhapus, error } = await supabase.from('lc_questions').delete().in('id', ids).select('id');
                      if (error || !terhapus || terhapus.length === 0) {
                        setDialog({ type: 'error', title: 'Gagal Hapus', message: error ? 'Error: ' + error.message : 'Tidak ada soal yang terhapus (tidak punya akses).' });
                        return;
                      }
                    }
                    load();
                  },
                });
              };

              return (
                <div key={mat.id}>
                  {/* Material header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: matColor.gradient }}>
                        📖 {mat.materi_name}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-sm">
                        {totalForMat} soal · {batchKeys.filter(b => b !== '').length} grup
                      </span>
                    </div>
                    <button
                      data-tulis onClick={() => handleDeleteMatGroup(mat.id, mat.materi_name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all"
                    >
                      <svg aria-hidden="true" focusable="false" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Hapus Semua ({totalForMat})
                    </button>
                  </div>

                  {/* Batch sub-groups — collapsible accordion */}
                  <GrupBatchSoal
                    batchKeys={batchKeys} buangDraf={buangDraf} bukaTambahDiGrup={bukaTambahDiGrup} expandedBatches={expandedBatches} geserSoal={geserSoal} handleDelete={handleDelete} handleDeleteBatch={handleDeleteBatch} kolomUrutanAda={kolomUrutanAda} mat={mat} matColor={matColor} menyimpanUrutan={menyimpanUrutan} qs={qs} setEditQ={setEditQ} setExpandedBatches={setExpandedBatches} simpanUrutan={simpanUrutan} susunanTampil={susunanTampil} urutanDraf={urutanDraf}
                  />
                </div>
              );
            })}
        </div>
        </div>{/* end max-w-5xl */}
      </div>
    </>
  );
}
