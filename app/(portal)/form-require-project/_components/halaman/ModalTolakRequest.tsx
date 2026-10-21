'use client';

/**
 * ModalTolakRequest - dipecah dari app/(portal)/form-require-project/page.tsx. Semua keadaan tetap milik induk.
 * Kerangka: ModalTolak bersama (components/shared/Persetujuan.tsx) - sama dengan Ticketing & Request Schedule.
 */
import { ModalTolak } from '@/components/shared';
import { ProjectRequest } from '../shared';

export interface ModalTolakRequestProps {
  handleRejectConfirm: () => Promise<void>;
  rejectModal: { open: boolean; req: ProjectRequest | null; };
  rejectNote: string;
  rejectSaving: boolean;
  setRejectModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setRejectNote: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function ModalTolakRequest({ handleRejectConfirm, rejectModal, rejectNote, rejectSaving, setRejectModal, setRejectNote }: ModalTolakRequestProps) {
  if (!rejectModal.open || !rejectModal.req) return null;
  return (
    <ModalTolak buka onTutup={() => setRejectModal({ open: false, req: null })} judul="Tolak Request" keterangan={rejectModal.req.project_name}
      lapisan="atas" alasan={rejectNote} onAlasan={setRejectNote} onTolak={() => { void handleRejectConfirm(); }} sibuk={rejectSaving} />
  );
}
