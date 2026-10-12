'use client';

/** ModalBuatFolder - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import React from 'react';
import { TechNoteFolder } from './shared';
import { Field, KATEGORI_FOLDER, Modal, inputCls } from './bagian-tech-note';

export interface ModalBuatFolderProps {
  folderForm: { name: string; icon: string; color: string; parent_id: string; category: string; };
  folders: TechNoteFolder[];
  saveFolder: () => Promise<void>;
  saving: boolean;
  setFolderForm: React.Dispatch<React.SetStateAction<{ name: string; icon: string; color: string; parent_id: string; category: string; }>>;
  setShowFolderModal: React.Dispatch<React.SetStateAction<boolean>>;
  showFolderModal: boolean;
}

export function ModalBuatFolder({ folderForm, folders, saveFolder, saving, setFolderForm, setShowFolderModal, showFolderModal }: ModalBuatFolderProps) {
  return (
    <>
      <Modal open={showFolderModal} onClose={()=>setShowFolderModal(false)} title="➕ Buat Folder Baru">
        <Field label="Nama Folder *">
          <input className={inputCls} value={folderForm.name}
            onChange={e=>setFolderForm(p=>({...p,name:e.target.value}))} placeholder="cth: Display Panel" />
        </Field>
        <Field label="Kategori *">
          <div className="grid grid-cols-3 gap-2">
            {KATEGORI_FOLDER.map(k => {
              const aktif = folderForm.category === k.value;
              return (
                <button key={k.value} type="button"
                  onClick={()=>setFolderForm(p=>({...p, category:k.value, icon:k.icon}))}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                    aktif ? 'bg-pink-50 border-pink-400 text-pink-800' : 'bg-white border-gray-200 text-slate-500 hover:border-gray-300'
                  }`}>
                  <span className="block text-lg leading-none mb-1"><Ikon nama={k.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
                  <span className="block text-sm font-bold">{k.label}</span>
                  <span className="block text-[11px] mt-0.5 opacity-80 leading-tight">{k.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Emoji folder mengikuti kategori yang dipilih — tidak diketik sendiri, supaya
            folder sejenis selalu berikon sama.
          </p>
        </Field>
        <Field label="Warna">
          <input type="color" value={folderForm.color} onChange={e=>setFolderForm(p=>({...p,color:e.target.value}))}
            className="w-full h-11 rounded-xl cursor-pointer p-1 border border-gray-200 bg-gray-50" />
        </Field>
        <Field label="Parent Folder (opsional)">
          <select aria-label="— Root (tidak ada parent) —" className={inputCls} value={folderForm.parent_id}
            onChange={e=>setFolderForm(p=>({...p,parent_id:e.target.value}))}>
            <option value="">— Root (tidak ada parent) —</option>
            {folders.filter(f=>!f.parent_id).map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={()=>setShowFolderModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors">Batal</button>
          <button onClick={saveFolder} disabled={saving||!folderForm.name.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors"
            style={{ background:'linear-gradient(135deg,#ec4899,#be185d)' }}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Folder'}
          </button>
        </div>
      </Modal>
    </>
  );
}
