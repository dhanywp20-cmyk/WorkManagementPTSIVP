'use client';
import { ModalTolak } from '@/components/shared';
import type { Reminder } from './shared';

/**
 * Modal "Tolak Request" dengan alasan - dipakai DUA alur: Sales Internal menolak (internalReject*) dan
 * Admin/Manager menolak di tahap admin_review (adminReject*). Kerangka: ModalTolak bersama
 * (components/shared/Persetujuan.tsx) - alasan wajib, sama dengan Ticketing & Request Design Project.
 */
export function RejectReasonModal({
  target, reason, setReason, saving, onConfirm, onCancel,
}: {
  target: Reminder;
  reason: string;
  setReason: (v: string) => void;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalTolak buka onTutup={onCancel} judul="Tolak Request" keterangan={target.project_name} lapisan="atas"
      alasan={reason} onAlasan={setReason} onTolak={() => onConfirm()} sibuk={saving} />
  );
}
