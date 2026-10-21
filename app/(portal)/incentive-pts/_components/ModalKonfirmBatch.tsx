'use client';

/** ModalKonfirmBatch - konfirmasi Process Batch satu tahun. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal } from '@/components/shared';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalKonfirmBatchProps {
  batchConfirm: boolean;
  batchProcessing: boolean;
  batchYear: number;
  handleBatchProcess: () => Promise<void>;
  setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalKonfirmBatch({ batchConfirm, batchProcessing, batchYear, handleBatchProcess, setBatchConfirm, tranches }: ModalKonfirmBatchProps) {
  if (!batchConfirm) return null;
  const cnt = tranches.filter(t => t.payment_year === batchYear && t.status === 'pending').length;
  return (
    <Modal buka onTutup={() => setBatchConfirm(false)} judul="Konfirmasi Process Batch" lapisan="maks"
      keterangan={<>Proses semua tranche <strong>payment_year = {batchYear}</strong> berstatus <strong>pending</strong>.</>}
      footer={<>
        <TombolModal onClick={() => setBatchConfirm(false)}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => { void handleBatchProcess(); }} disabled={batchProcessing}>{batchProcessing ? 'Memproses...' : 'Proses Sekarang'}</TombolModal>
      </>}>
      <div className="space-y-3">
        {cnt > 0
          ? <p className="text-sm font-bold text-slate-800">{cnt} tranche siap diproses</p>
          : <KotakInfo nada="awas">Tidak ada tranche pending untuk tahun {batchYear}. Pastikan tranche sudah di-generate terlebih dahulu.</KotakInfo>}
        {/*  Bisa dibatalkan: tombol "Batalkan Batch" muncul sesudahnya. Yang tidak bisa ditarik hanya tahap Paid. */}
        <KotakInfo judul="Bisa dibatalkan">
          Setelah diproses, tombol <strong>Batalkan Batch {batchYear}</strong> muncul untuk mengembalikan tahapan ini ke Pending.
          Yang sudah bertanda <strong>Paid</strong> tidak ikut bisa dibatalkan - status itu berarti uangnya sudah keluar.
        </KotakInfo>
      </div>
    </Modal>
  );
}
