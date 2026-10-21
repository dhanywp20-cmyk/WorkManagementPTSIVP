'use client';

/**
 * ModalApprovalNote - keputusan atas Tech Note (Setujui / Minta Revisi / Tolak). Semua keadaan tetap milik induk.
 * Kerangka: Modal bersama + label pola persetujuan (components/shared/Persetujuan.tsx) - sama dengan menu lain.
 */
import { TechNote, formatDateShort } from './shared';
import React from 'react';
import { KotakInfo, LabelIsian, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';

export interface ModalApprovalNoteProps {
  approvalForm: { action: string; note: string; };
  approveModal: TechNote | null;
  saving: boolean;
  setApprovalForm: React.Dispatch<React.SetStateAction<{ action: string; note: string; }>>;
  setApproveModal: React.Dispatch<React.SetStateAction<TechNote | null>>;
  submitApproval: () => Promise<void>;
}

const AKSI: Record<string, { opsi: string; tombol: string; jenis: 'utama' | 'bahaya' | 'batal' }> = {
  approved: { opsi: 'Setujui - Tech Note tampil ke semua tim', tombol: 'Setujui', jenis: 'utama' },
  revision_requested: { opsi: 'Minta Revisi - perlu perbaikan', tombol: 'Kirim Permintaan Revisi', jenis: 'utama' },
  rejected: { opsi: 'Tolak - Tech Note ditolak', tombol: 'Tolak', jenis: 'bahaya' },
};

export function ModalApprovalNote({ approvalForm, approveModal, saving, setApprovalForm, setApproveModal, submitApproval }: ModalApprovalNoteProps) {
  if (!approveModal) return null;
  const aksi = AKSI[approvalForm.action] ?? AKSI.approved;
  //  Setujui boleh tanpa catatan; Minta Revisi & Tolak wajib beralasan (sama dengan ModalTolak di menu lain).
  const perluCatatan = approvalForm.action !== 'approved';
  return (
    <Modal buka onTutup={() => setApproveModal(null)} judul="Keputusan Tech Note" tutupDiLuar={false}
      keterangan={`"${approveModal.title}" · oleh ${approveModal.author_name} · ${formatDateShort(approveModal.submitted_at)}`}
      footer={<>
        <TombolModal onClick={() => setApproveModal(null)} disabled={saving}>Batal</TombolModal>
        <TombolModal jenis={aksi.jenis} onClick={() => { void submitApproval(); }} disabled={saving || (perluCatatan && !approvalForm.note.trim())}>
          {saving ? 'Memproses...' : aksi.tombol}
        </TombolModal>
      </>}>
      <div className="space-y-4">
        <div>
          <LabelIsian htmlFor="f-tech-note-keputusan" wajib>Keputusan</LabelIsian>
          <select id="f-tech-note-keputusan" className={kelasIsian} value={approvalForm.action}
            onChange={e => setApprovalForm(p => ({ ...p, action: e.target.value }))}>
            {Object.entries(AKSI).map(([v, a]) => <option key={v} value={v}>{a.opsi}</option>)}
          </select>
        </div>
        <div>
          <LabelIsian htmlFor="f-tech-note-catatan" wajib={perluCatatan}>{perluCatatan ? 'Alasan / yang perlu diperbaiki' : 'Catatan (opsional)'}</LabelIsian>
          <textarea id="f-tech-note-catatan" className={kelasIsian} rows={3} value={approvalForm.note}
            onChange={e => setApprovalForm(p => ({ ...p, note: e.target.value }))}
            placeholder={perluCatatan ? 'Jelaskan apa yang perlu diperbaiki...' : 'Berikan komentar...'} />
        </div>
        {approvalForm.action === 'approved' && <KotakInfo nada="baik">Tech Note otomatis tampil ke semua anggota tim setelah disetujui.</KotakInfo>}
      </div>
    </Modal>
  );
}
