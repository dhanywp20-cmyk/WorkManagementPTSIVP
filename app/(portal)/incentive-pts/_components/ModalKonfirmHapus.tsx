'use client';

/** ModalKonfirmHapus - keluarkan project dari Incentive. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';
import { IncentiveProjectRow, formatRupiah } from './calc';

export interface ModalKonfirmHapusProps {
  jalankanHapus: () => Promise<void>;
  konfirmHapus: IncentiveProjectRow[] | null;
  menghapus: boolean;
  setKonfirmHapus: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
}

export function ModalKonfirmHapus({ jalankanHapus, konfirmHapus, menghapus, setKonfirmHapus }: ModalKonfirmHapusProps) {
  if (!konfirmHapus) return null;
  const tutup = () => { if (!menghapus) setKonfirmHapus(null); };
  return (
    <Modal buka onTutup={tutup} judul={`Keluarkan ${konfirmHapus.length} project dari Incentive?`}
      footer={<>
        <TombolModal onClick={tutup} disabled={menghapus}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void jalankanHapus(); }} disabled={menghapus}>{menghapus ? 'Memproses...' : 'Ya, keluarkan'}</TombolModal>
      </>}>
      <div className="space-y-3">
        <ul className="max-h-40 overflow-y-auto space-y-1 rounded-kontrol bg-slate-50 border border-slate-200 p-2.5">
          {konfirmHapus.map(p => (
            <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
              • {p.project_name}
              {(p.incentive_value || 0) > 0 && <span className="ml-1 text-[11px] font-bold text-emerald-700">{formatRupiah(p.incentive_value || 0)}</span>}
            </li>
          ))}
        </ul>
        <div className="text-[13px] leading-relaxed space-y-1.5">
          <p className="text-rose-700"><strong>Yang hilang:</strong> project tidak lagi muncul di daftar Incentive PTS dan tidak ikut dihitung pembagiannya.</p>
          <p className="text-emerald-700"><strong>Yang tetap:</strong> jadwalnya di Request Schedule, beserta seluruh riwayat dan catatan aktivitasnya - tidak ada yang dihapus.</p>
          <p className="text-slate-600">Bisa dikembalikan kapan saja lewat tombol <strong>Sync ke Incentive</strong> di Request Schedule.</p>
        </div>
      </div>
    </Modal>
  );
}
