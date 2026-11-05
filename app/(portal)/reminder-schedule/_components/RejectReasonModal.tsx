'use client';
import { ModalTolak } from '@/components/shared';
import type { Reminder } from './shared';

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
