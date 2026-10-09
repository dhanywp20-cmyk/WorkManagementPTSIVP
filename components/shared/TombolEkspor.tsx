'use client';
/**
 * Tombol ekspor daftar yang SAMA di semua menu: Excel · Cetak (A4) · PNG - isinya mengikuti filter
 * yang sedang aktif. `data` dipanggil saat tombol diklik (bukan tiap render). Lihat lib/ekspor-tabel.ts.
 */
import { useState } from 'react';
import { cetakTabel, type Ekspor, eksporExcel, pngTabel } from '@/lib/ekspor-tabel';
import { Ikon } from './Ikon';

export function TombolEkspor<T>({ data, jumlah, label = true }: { data: () => Ekspor<T>; jumlah: number; label?: boolean }) {
  const [sibuk, setSibuk] = useState<'' | 'excel' | 'png'>('');
  const [gagal, setGagal] = useState('');
  const jalan = async (jenis: 'excel' | 'png', f: () => Promise<void>) => {
    setSibuk(jenis); setGagal('');
    try { await f(); } catch (x) { setGagal(x instanceof Error ? x.message : 'Gagal mengekspor.'); setTimeout(() => setGagal(''), 4000); }
    setSibuk('');
  };
  const kosong = jumlah === 0;
  const kelas = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
  const judul = kosong ? 'Tidak ada baris untuk diekspor' : undefined;
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap print:hidden" role="group" aria-label="Ekspor daftar">
      <button type="button" className={kelas} disabled={kosong || sibuk !== ''} title={judul ?? 'Unduh Excel (sesuai filter)'} onClick={() => void jalan('excel', () => eksporExcel(data()))}>
        <Ikon nama="📊" ukuran={14} /> {label && (sibuk === 'excel' ? '…' : 'Excel')}
      </button>
      <button type="button" className={kelas} disabled={kosong} title={judul ?? 'Cetak A4 (sesuai filter)'} onClick={() => cetakTabel(data())}>
        <Ikon nama="🖨" ukuran={14} /> {label && 'Cetak'}
      </button>
      <button type="button" className={kelas} disabled={kosong || sibuk !== ''} title={judul ?? 'Unduh gambar PNG (sesuai filter)'} onClick={() => void jalan('png', () => pngTabel(data()))}>
        <Ikon nama="🖼" ukuran={14} /> {label && (sibuk === 'png' ? '…' : 'PNG')}
      </button>
      {gagal && <span role="status" className="text-[11px] font-semibold text-rose-700">{gagal}</span>}
    </div>
  );
}
