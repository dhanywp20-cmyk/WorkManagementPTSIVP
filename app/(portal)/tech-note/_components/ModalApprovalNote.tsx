'use client';

/** ModalApprovalNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { TechNote, formatDateShort } from './shared';
import { IkonTeks } from '@/components/shared/Ikon';
import React from 'react';
import { Field, Modal, inputCls } from './bagian-tech-note';

export interface ModalApprovalNoteProps {
  approvalForm: { action: string; note: string; };
  approveModal: TechNote | null;
  saving: boolean;
  setApprovalForm: React.Dispatch<React.SetStateAction<{ action: string; note: string; }>>;
  setApproveModal: React.Dispatch<React.SetStateAction<TechNote | null>>;
  submitApproval: () => Promise<void>;
}

export function ModalApprovalNote({ approvalForm, approveModal, saving, setApprovalForm, setApproveModal, submitApproval }: ModalApprovalNoteProps) {
  return (
    <>
      {approveModal && (
        <Modal open={!!approveModal} onClose={()=>setApproveModal(null)} title="📋 Keputusan Approval" width={460}>
          <p className="text-[13px] text-slate-500 mb-4">
            Tech Note: <b className="text-slate-800">"{approveModal.title}"</b><br/>
            <span className="text-[11px] text-slate-500">oleh {approveModal.author_name} · {formatDateShort(approveModal.submitted_at)}</span>
          </p>
          <Field label="Keputusan *">
            <select className={inputCls} value={approvalForm.action}
              onChange={e=>setApprovalForm(p=>({...p,action:e.target.value}))}>
              <option value="approved">Approve — Setujui Tech Note</option>
              <option value="revision_requested">Minta Revisi — Perlu perbaikan</option>
              <option value="rejected">Tolak — Tech Note ditolak</option>
            </select>
          </Field>
          <Field label={`Catatan ${approvalForm.action==='approved'?'(opsional)':'*'}`}>
            <textarea className={inputCls} rows={3} value={approvalForm.note}
              onChange={e=>setApprovalForm(p=>({...p,note:e.target.value}))}
              placeholder={approvalForm.action==='approved'?'Berikan komentar positif...':'Jelaskan apa yang perlu diperbaiki...'} />
          </Field>
          {approvalForm.action==='approved' && (
            <div className="rounded-xl px-4 py-2.5 text-[12px] font-medium mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700">
              <IkonTeks nama="✅" />Tech Note akan otomatis tampil ke semua anggota tim setelah disetujui.
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={()=>setApproveModal(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-gray-100 border border-gray-200 hover:bg-gray-200">Batal</button>
            <button onClick={submitApproval} disabled={saving}
              className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors"
              style={{ background: approvalForm.action==='approved'?'#059669':approvalForm.action==='revision_requested'?'#d97706':'#6b7280' }}>
              {saving?'⏳...':approvalForm.action==='approved'?'✅ Konfirmasi Approve':approvalForm.action==='revision_requested'?'🔄 Kirim Revisi':'❌ Tolak'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
