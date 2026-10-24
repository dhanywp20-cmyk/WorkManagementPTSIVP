'use client';

/** ModalUnggahNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import React from 'react';
import { TechNoteFolder, TechNote } from './shared';
import { Field, Modal, inputCls, linkOneDriveSah } from './bagian-tech-note';

export interface ModalUnggahNoteProps {
  closeUploadModal: () => void;
  editingNote: TechNote | null;
  folders: TechNoteFolder[];
  saving: boolean;
  setUploadForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; product: string; one_drive_link: string; folder_id: string; tags: string; }>>;
  showUploadModal: boolean;
  submitTechNote: () => Promise<void>;
  uploadForm: { title: string; description: string; product: string; one_drive_link: string; folder_id: string; tags: string; };
}

export function ModalUnggahNote({ closeUploadModal, editingNote, folders, saving, setUploadForm, showUploadModal, submitTechNote, uploadForm }: ModalUnggahNoteProps) {
  return (
    <>
      <Modal open={showUploadModal}
        onClose={closeUploadModal}
        title={editingNote ? '✏️ Edit Tech Note' : '📤 Upload Tech Note'} width={600}>
        <Field label="Judul Tech Note *">
          <input className={inputCls} value={uploadForm.title}
            onChange={e=>setUploadForm(p=>({...p,title:e.target.value}))} placeholder="cth: Prosedur Setup Display Newline" />
        </Field>
        <Field label="Deskripsi">
          <textarea className={inputCls} rows={3} value={uploadForm.description}
            onChange={e=>setUploadForm(p=>({...p,description:e.target.value}))} placeholder="Jelaskan isi Tech Note secara singkat..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nama Produk *">
            <input className={inputCls} value={uploadForm.product}
              onChange={e=>setUploadForm(p=>({...p,product:e.target.value}))} placeholder="cth: Newline NT-86" />
          </Field>
          <Field label="Folder *">
            <select aria-label="— Pilih Folder —" className={inputCls} value={uploadForm.folder_id}
              onChange={e=>setUploadForm(p=>({...p,folder_id:e.target.value}))}>
              <option value="">— Pilih Folder —</option>
              {folders.map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="🔗 Link OneDrive *">
          <input className={inputCls} value={uploadForm.one_drive_link}
            onChange={e=>setUploadForm(p=>({...p,one_drive_link:e.target.value}))} placeholder="https://1drv.ms/b/..." />
          {uploadForm.one_drive_link.trim() && !linkOneDriveSah(uploadForm.one_drive_link) && (
            <p className="text-[11.5px] text-rose-600 mt-1">Link OneDrive / SharePoint (https)</p>
          )}
        </Field>
        <Field label="Tags (pisahkan koma)">
          <input className={inputCls} value={uploadForm.tags}
            onChange={e=>setUploadForm(p=>({...p,tags:e.target.value}))} placeholder="cth: setup, display, newline" />
        </Field>
        <div className="rounded-xl px-4 py-3 text-[12px] font-medium mb-4 bg-amber-50 border border-amber-200 text-amber-700">
          <IkonTeks nama="⚠" />Tech Note akan masuk ke <b>Approval Queue</b>. Setelah disetujui Admin/Supervisor, otomatis tampil ke semua anggota tim.
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={closeUploadModal} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-gray-100 border border-gray-200 hover:bg-gray-200">Batal</button>
          <button onClick={submitTechNote} disabled={saving||!uploadForm.title.trim()||!uploadForm.folder_id||!linkOneDriveSah(uploadForm.one_drive_link)}
            className="tombol-utama px-4 py-2 rounded-kontrol text-sm font-bold disabled:opacity-40 transition-colors">
            {saving ? '⏳ Mengirim...' : '📤 Submit untuk Review'}
          </button>
        </div>
      </Modal>
    </>
  );
}
