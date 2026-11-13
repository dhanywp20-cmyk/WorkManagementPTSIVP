'use client';
import type React from 'react';
import { CopyPlus, Plus, Trash2 } from 'lucide-react';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { Keterangan } from '@/components/shared/Keterangan';
import { jumlahRuang, namaRuangKe } from '@/lib/sld/ruang';
import { MAKS_RUANG } from '@/lib/sld/tipe';
import { Pemisah, TombolIkon } from './MenuBilah';
import type { KeadaanSLD } from './useKeadaanSLD';

export function BilahRuang({ a, konfirmasi, kanan }: { a: KeadaanSLD; konfirmasi: (s: ConfirmState) => void; kanan?: React.ReactNode }) {
  const n = jumlahRuang(a.proyek), i = a.ruangAktif;
  const nama = (i === 0 ? a.proyek.namaRuang : a.proyek.ruangLain?.[i - 1]?.nama) ?? '';
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-1.5 py-1" aria-label="Ruangan & lembar" role="group">
      <span className="inline-flex items-center gap-1 pl-1 pr-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
        Ruangan
        <Keterangan>Tiap ruangan punya Sheet 1 &amp; 2 sendiri. BOQ (Sheet 3) memuat semua ruangan per section.</Keterangan>
      </span>
      <div className="flex flex-wrap gap-0.5" role="tablist" aria-label="Pilih ruangan">
        {Array.from({ length: n }, (_, k) => (
          <button key={k} type="button" role="tab" aria-selected={i === k} onClick={() => a.pilihRuang(k)}
            className={`h-7 px-2.5 rounded-md text-[12px] font-bold transition-colors duration-150 ${i === k ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {namaRuangKe(a.proyek, k)}
          </button>
        ))}
      </div>
      <TombolIkon ikon={Plus} label="Tambah ruangan" onClick={a.tambahRuangBaru} disabled={n >= MAKS_RUANG} />
      <Pemisah />
      <input value={nama} onChange={e => a.namaiRuangKe(i, e.target.value)} placeholder={`Nama ruangan ${i + 1}`} aria-label="Nama ruangan yang dibuka"
        className="h-7 w-44 rounded-md border border-transparent bg-transparent px-2 text-[12.5px] font-semibold text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-hidden" />
      <TombolIkon ikon={CopyPlus} label="Duplikat ruangan (perangkat, kabel, teks, area & isian BOQ)" onClick={() => a.duplikatRuangKe(i)} disabled={n >= MAKS_RUANG} />
      {n > 1 && (
        <TombolIkon ikon={Trash2} label="Hapus ruangan" className="!text-rose-700 hover:!bg-rose-50" onClick={() => konfirmasi({
          message: `Hapus ${namaRuangKe(a.proyek, i)}?`, description: 'Semua perangkat, kabel & teks di ruangan ini ikut terhapus. Bisa dibatalkan dengan Ctrl+Z.',
          confirmLabel: 'Hapus ruangan', danger: true, onConfirm: () => a.hapusRuangKe(i),
        })} />
      )}
      {kanan && <div className="ml-auto flex items-center gap-1">{kanan}</div>}
    </div>
  );
}
