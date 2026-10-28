'use client';

/** ModalKonfirmGenerateMassal - konfirmasi generate tahapan untuk banyak project. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';
import { IncentiveProjectRow, formatRupiah } from './calc';

export interface ModalKonfirmGenerateMassalProps {
  bulkGenerateConfirm: IncentiveProjectRow[] | null;
  bulkGenerating: boolean;
  filterBastYear: number | null;
  jalankanBulkGenerate: () => Promise<void>;
  setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
}

export function ModalKonfirmGenerateMassal({ bulkGenerateConfirm, bulkGenerating, filterBastYear, jalankanBulkGenerate, setBulkGenerateConfirm }: ModalKonfirmGenerateMassalProps) {
  if (!bulkGenerateConfirm) return null;
  const tutup = () => { if (!bulkGenerating) setBulkGenerateConfirm(null); };
  return (
    <Modal buka onTutup={tutup} judul={`Generate Tahapan untuk ${bulkGenerateConfirm.length} project - Tahun BAST ${filterBastYear}?`}
      footer={<>
        <TombolModal onClick={tutup} disabled={bulkGenerating}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => { void jalankanBulkGenerate(); }} disabled={bulkGenerating}>{bulkGenerating ? 'Memproses...' : `Generate ${bulkGenerateConfirm.length} Tahapan`}</TombolModal>
      </>}>
      <div className="space-y-3">
        <ul className="max-h-52 overflow-y-auto space-y-1 rounded-kontrol bg-slate-50 border border-slate-200 p-2.5">
          {bulkGenerateConfirm.map(p => (
            <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
              • {p.project_name}
              <span className="ml-1 text-[11px] font-bold text-emerald-700">{formatRupiah(p.incentive_value || 0)}</span>
            </li>
          ))}
        </ul>
        <div className="text-[13px] leading-relaxed space-y-1.5 text-slate-600">
          <p>Tiap project diproses satu-satu lewat fungsi yang sama dengan tombol <strong>Generate Tranche</strong> perorangan - persentase per tahap dan tahun pembayaran dihitung dari BAST masing-masing project, bukan tanggal hari ini.</p>
          <p>Project yang <strong>sudah</strong> punya tahapan (dibuat orang lain sesudah daftar ini dimuat) otomatis dilewati - tidak akan dibuat dobel.</p>
        </div>
      </div>
    </Modal>
  );
}
