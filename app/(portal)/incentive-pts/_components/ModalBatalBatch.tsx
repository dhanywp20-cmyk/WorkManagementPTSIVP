'use client';

/** ModalBatalBatch - batalkan hasil batch satu tahun. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalBatalBatchProps {
  batalBatch: number | null;
  jalankanBatalBatch: () => Promise<void>;
  ketikBatalBatch: string;
  membatalkan: boolean;
  setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalBatalBatch({ batalBatch, jalankanBatalBatch, ketikBatalBatch, membatalkan, setBatalBatch, setKetikBatalBatch, tranches }: ModalBatalBatchProps) {
  if (batalBatch === null) return null;
  const bisa = tranches.filter(t => t.payment_year === batalBatch && t.status === 'processed').length;
  const paid = tranches.filter(t => t.payment_year === batalBatch && t.status === 'paid').length;
  const kunci = `BATALKAN ${batalBatch}`;
  const tutup = () => { setBatalBatch(null); setKetikBatalBatch(''); };
  return (
    <Modal buka onTutup={tutup} judul={`Batalkan Batch ${batalBatch}`} lapisan="maks" tutupDiLuar={false}
      keterangan="Baris pembagian hasil batch tahun ini dihapus, dan tahapannya kembali ke Pending supaya bisa diproses ulang."
      footer={<>
        <TombolModal onClick={tutup}>Tutup</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void jalankanBatalBatch(); }} disabled={membatalkan || ketikBatalBatch.trim().toUpperCase() !== kunci || bisa === 0}>
          {membatalkan ? 'Memproses...' : 'Batalkan'}
        </TombolModal>
      </>}>
      <div className="space-y-3">
        <div className="rounded-kontrol border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-sm">
          <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Dikembalikan ke Pending</span><strong className="text-slate-800">{bisa} tahapan</strong></div>
          <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Dilewati (sudah Paid)</span><strong className="text-slate-800">{paid} tahapan</strong></div>
        </div>
        <KotakInfo>Tahapannya sendiri TIDAK dihapus - hanya hasil pemrosesannya. Nominal proyek tetap terkunci. Untuk menghapus tahapan, pakai tombol ↩️ di baris proyeknya.</KotakInfo>
        <div>
          <label htmlFor="f-incentive-pts-page-2" className="block text-xs font-bold text-slate-700 mb-1.5">
            Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1 rounded">{kunci}</span> untuk melanjutkan
          </label>
          <input id="f-incentive-pts-page-2" type="text" value={ketikBatalBatch} autoFocus onChange={e => setKetikBatalBatch(e.target.value)} placeholder={kunci} className={kelasIsian} />
        </div>
      </div>
    </Modal>
  );
}
