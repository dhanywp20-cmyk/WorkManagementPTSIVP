'use client';
import { Modal, TombolModal } from '@/components/shared';

export function BulkDeleteConfirmModal({
  jumlah, onCancel, onConfirm,
}: {
  jumlah: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal buka onTutup={onCancel} judul={`Hapus ${jumlah} Jadwal?`} keterangan="Tindakan ini tidak dapat dibatalkan." ukuran="sm"
      footer={<>
        <TombolModal onClick={onCancel}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={onConfirm}>Ya, Hapus Permanen</TombolModal>
      </>}>
      <p className="text-sm text-slate-600">Kamu akan menghapus <strong>{jumlah} jadwal</strong> yang dipilih secara permanen dari sistem.</p>
    </Modal>
  );
}
