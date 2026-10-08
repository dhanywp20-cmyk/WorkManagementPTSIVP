'use client';

/** GridSubfolderSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { supabase, Question, FolderNode, DialogState } from '../shared';
import { getFolderColor } from '../QuestionsPage';

export interface GridSubfolderSoalProps {
  currentFolderNode: FolderNode | null;
  load: () => Promise<void>;
  questions: Question[];
  selectedSubFolder: string | null;
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setRenameFolder: import("react").Dispatch<import("react").SetStateAction<{ oldName: string; newName: string; } | null>>;
  setSelectedSubFolder: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  subFolders: string[];
}

export function GridSubfolderSoal({ currentFolderNode, load, questions, selectedSubFolder, setDialog, setRenameFolder, setSelectedSubFolder, subFolders }: GridSubfolderSoalProps) {
  return (
    <>
      {subFolders.length > 0 && !selectedSubFolder && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
            {subFolders.map(sfKey => {
              const sfNode = currentFolderNode!.children[sfKey];
              const sfQCount = questions.filter(q => sfNode.materials.map(m => m.id).includes(q.material_id)).length;
              const fc = getFolderColor(sfKey);
              return (
                <div key={sfKey} className="group relative">
                  <button
                    onClick={() => setSelectedSubFolder(sfKey)}
                    className="w-full flex flex-col p-3 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: fc.light }}>
                      <svg aria-hidden="true" focusable="false" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate pr-6">{sfKey}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sfNode.materials.length} materi · {sfQCount} soal</p>
                    <div className="flex justify-end mt-1.5">
                      <svg aria-hidden="true" focusable="false" width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                  {/* Subfolder action buttons */}
                  <div data-tulis className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button aria-label="Ubah nama subfolder"
                      onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: sfKey, newName: sfKey }); }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                      title="Ubah nama subfolder">
                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button aria-label="Hapus semua soal subfolder"
                      onClick={e => {
                        e.stopPropagation();
                        // Delete all questions in this subfolder
                        const sfQIds = sfNode.materials.map(m => m.id);
                        const sfQCount = questions.filter(q => sfQIds.includes(q.material_id)).length;
                        setDialog({
                          type: 'confirm', title: 'Hapus Soal Subfolder',
                          message: `Semua ${sfQCount} soal dalam subfolder "${sfKey}" akan dihapus permanen. Lanjutkan?`,
                          confirmLabel: 'Hapus Semua',
                          onConfirm: async () => {
                            if (sfQIds.length > 0) {
                              const sfQuestionIds = questions.filter(q => sfQIds.includes(q.material_id)).map(q => q.id);
                              if (sfQuestionIds.length > 0) await supabase.from('lc_answers').delete().in('question_id', sfQuestionIds);
                              const { error } = await supabase.from('lc_questions').delete().in('material_id', sfQIds);
                              if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
                            }
                            load();
                          },
                        });
                      }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                      title="Hapus semua soal subfolder">
                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {currentFolderNode?.materials && currentFolderNode.materials.length > 0 && (() => {
              const fc = getFolderColor('Langsung');
              return (
                <button
                  onClick={() => setSelectedSubFolder('__direct__')}
                  className="group flex flex-col p-3 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: fc.light }}>
                    <svg aria-hidden="true" focusable="false" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-slate-800">Langsung</p>
                  <p className="text-xs text-slate-500 mt-0.5">{currentFolderNode.materials.length} materi</p>
                  <div className="flex justify-end mt-1.5">
                    <svg aria-hidden="true" focusable="false" width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
