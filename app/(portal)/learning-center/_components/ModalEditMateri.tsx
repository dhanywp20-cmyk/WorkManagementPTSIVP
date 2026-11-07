'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Material } from './shared';
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

export function ModalEditMateri({ editMaterial, setEditMaterial, existingPaths, editMaterialSaving, handleEditMaterial }: {
  editMaterial: Material;
  setEditMaterial: Dispatch<SetStateAction<Material | null>>;
  existingPaths: string[];
  editMaterialSaving: boolean;
  handleEditMaterial: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
        <div className="bg-white rounded-kartu shadow-modal w-full max-w-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><IkonTeks nama="✏" />Edit Materi</h3>
            <button aria-label="Tutup" onClick={() => setEditMaterial(null)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="f-learning-center-components-materipage-6" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
              <input id="f-learning-center-components-materipage-6"
                value={editMaterial.materi_name}
                onChange={e => setEditMaterial(p => p && ({ ...p, materi_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                autoFocus
                placeholder="Nama materi..." />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-materipage-7" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                Folder Path <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">(opsional)</span>
              </label>
              <input id="f-learning-center-components-materipage-7"
                value={editMaterial.folder_path ?? ''}
                onChange={e => setEditMaterial(p => p && ({ ...p, folder_path: e.target.value }))}
                list="edit-folder-path-suggestions"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="contoh: Produk/Microvision" />
              <datalist id="edit-folder-path-suggestions">
                {existingPaths.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="f-learning-center-components-materipage-8" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                Link OneDrive <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">(opsional)</span>
              </label>
              <input id="f-learning-center-components-materipage-8"
                value={editMaterial.file_url ?? ''}
                onChange={e => setEditMaterial(p => p && ({ ...p, file_url: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="https://1drv.ms/b/s!..." />
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button onClick={() => setEditMaterial(null)}
              className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all">
              Batal
            </button>
            <button onClick={handleEditMaterial} disabled={editMaterialSaving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-60">
              {editMaterialSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan...
                </span>
              ) : '💾 Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
