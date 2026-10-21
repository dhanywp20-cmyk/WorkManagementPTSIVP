'use client';

/** ModalHasilGenerateMassal - ringkasan hasil generate tahapan massal. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';

export interface ModalHasilGenerateMassalProps {
  bulkGenerateResult: { tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string; }[]; dilewati: string[]; } | null;
  setBulkGenerateResult: import("react").Dispatch<import("react").SetStateAction<{ tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string; }[]; dilewati: string[]; } | null>>;
}

export function ModalHasilGenerateMassal({ bulkGenerateResult, setBulkGenerateResult }: ModalHasilGenerateMassalProps) {
  if (!bulkGenerateResult) return null;
  const tutup = () => setBulkGenerateResult(null);
  const Bagian = ({ judul, warna, isi }: { judul: string; warna: string; isi: string[] }) => isi.length ? (
    <div>
      <p className={`text-xs font-bold mb-1 ${warna}`}>{judul} ({isi.length})</p>
      <ul className="text-[13px] text-slate-600 space-y-0.5">{isi.map(n => <li key={n}>• {n}</li>)}</ul>
    </div>
  ) : null;
  return (
    <Modal buka onTutup={tutup} judul={`Hasil Generate Tahapan Massal ${bulkGenerateResult.tahun}`} footer={<TombolModal onClick={tutup}>Tutup</TombolModal>}>
      <div className="space-y-3">
        <Bagian judul="Berhasil" warna="text-emerald-700" isi={bulkGenerateResult.berhasil} />
        <Bagian judul="Dilewati - sudah ada tahapan" warna="text-amber-700" isi={bulkGenerateResult.dilewati} />
        <Bagian judul="Gagal" warna="text-rose-700" isi={bulkGenerateResult.gagal.map(g => `${g.nama} — ${g.alasan}`)} />
      </div>
    </Modal>
  );
}
