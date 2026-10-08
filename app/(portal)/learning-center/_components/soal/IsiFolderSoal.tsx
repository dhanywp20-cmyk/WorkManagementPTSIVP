'use client';

/** IsiFolderSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Material, Question, FolderNode } from '../shared';
import { Ikon } from '@/components/shared/Ikon';
import { getFolderColor } from '../QuestionsPage';

export interface IsiFolderSoalProps {
  folderTree: FolderNode;
  generatePanelJSX: import("react").JSX.Element;
  handleDeleteFolder: (fKey: string) => void;
  questions: Question[];
  rootFolders: string[];
  rootMaterials: Material[];
  setRenameFolder: import("react").Dispatch<import("react").SetStateAction<{ oldName: string; newName: string; } | null>>;
  setSelectedFolder: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSelectedSubFolder: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  showGenerate: boolean;
}

export function IsiFolderSoal({ folderTree, generatePanelJSX, handleDeleteFolder, questions, rootFolders, rootMaterials, setRenameFolder, setSelectedFolder, setSelectedSubFolder, showGenerate }: IsiFolderSoalProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
        {showGenerate && generatePanelJSX}

        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {rootMaterials.length > 0 && (() => {
              const fc = getFolderColor('Tanpa');
              return (
                <button
                  onClick={() => setSelectedFolder('__root__')}
                  className="group flex flex-col p-4 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: fc.light }}
                  >
                    <svg aria-hidden="true" focusable="false" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-slate-800 truncate">Tanpa Folder</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {questions.filter(q => rootMaterials.map(m => m.id).includes(q.material_id)).length} soal
                  </p>
                  <div className="flex justify-end mt-2">
                    <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })()}
            {rootFolders.map(fKey => {
              const fNode = folderTree.children[fKey];
              const collectMats = (n: FolderNode): Material[] => [...n.materials, ...Object.values(n.children).flatMap(child => collectMats(child))];
              const matIds = collectMats(fNode).map(m => m.id);
              const qCount = questions.filter(q => matIds.includes(q.material_id)).length;
              const subCount = Object.keys(fNode.children).length;
              const fc = getFolderColor(fKey);
              return (
                <div key={fKey} className="group relative">
                  <button
                    onClick={() => { setSelectedFolder(fKey); setSelectedSubFolder(null); }}
                    className="w-full flex flex-col p-4 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: fc.light }}>
                      <svg aria-hidden="true" focusable="false" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate pr-6">{fKey}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{subCount > 0 ? `${subCount} subfolder · ` : ''}{qCount} soal</p>
                  </button>
                  {/* Folder action buttons */}
                  <div data-tulis className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button aria-label="Ubah nama folder"
                      onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: fKey, newName: fKey }); }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                      title="Ubah nama folder">
                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button aria-label="Hapus semua soal folder"
                      onClick={e => { e.stopPropagation(); handleDeleteFolder(fKey); }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                      title="Hapus semua soal folder">
                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {rootFolders.length === 0 && rootMaterials.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="text-center px-10 py-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                <div className="text-5xl mb-3"><Ikon nama="🧩" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                <p className="font-semibold text-slate-700">Belum ada materi</p>
                <p className="text-sm mt-1 text-slate-500">Tambah materi di tab Materi terlebih dahulu</p>
              </div>
            </div>
          )}
        </div>
        </div>{/* end max-w-5xl */}
      </div>
    </>
  );
}
