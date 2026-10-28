'use client';

/** ModalHapusMassal - hapus banyak request sekaligus. Kerangka: Modal bersama (sama dengan Ticketing & Request Schedule). */
import { Modal, TombolModal } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import { ProjectRequest } from '../shared';

export interface ModalHapusMassalProps {
  bulkConfirm: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBulkDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRequests: import("react").Dispatch<import("react").SetStateAction<ProjectRequest[]>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
}

export function ModalHapusMassal({ bulkConfirm, notify, selectedIds, setBulkConfirm, setBulkDeleting, setRequests, setSelectMode, setSelectedIds }: ModalHapusMassalProps) {
  if (!bulkConfirm) return null;
  const hapus = async () => {
    setBulkConfirm(false); setBulkDeleting(true);
    const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
    if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
    else notify('error', 'Gagal: ' + error.message);
    setBulkDeleting(false);
  };
  return (
    <Modal buka onTutup={() => setBulkConfirm(false)} judul={`Hapus ${selectedIds.size} Request?`} keterangan="Tindakan ini tidak dapat dibatalkan." ukuran="sm"
      footer={<>
        <TombolModal onClick={() => setBulkConfirm(false)}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void hapus(); }}>Ya, Hapus Permanen</TombolModal>
      </>}>
      <p className="text-sm text-slate-600">Kamu akan menghapus <strong>{selectedIds.size} request project</strong> yang dipilih secara permanen.</p>
    </Modal>
  );
}
