'use client';
import { CopyPlus, Plus, Trash2 } from 'lucide-react';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { jumlahRuang, namaRuangKe } from '@/lib/sld/ruang';
import { MAKS_RUANG } from '@/lib/sld/tipe';
import { kelasTombol } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

export function BilahRuang({ a, konfirmasi }: { a: KeadaanSLD; konfirmasi: (s: ConfirmState) => void }) {
  const n = jumlahRuang(a.proyek), i = a.ruangAktif;
  const nama = (i === 0 ? a.proyek.namaRuang : a.proyek.ruangLain?.[i - 1]?.nama) ?? '';
  return (
    <section className="rounded-2xl bg-white border border-slate-200 px-2.5 py-2 flex flex-wrap items-center gap-1.5" aria-label="Ruangan">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 mr-1">Ruangan</span>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Pilih ruangan">
        {Array.from({ length: n }, (_, k) => (
          <button key={k} type="button" role="tab" aria-selected={i === k} onClick={() => a.pilihRuang(k)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border transition-colors duration-150 ${i === k ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
            {namaRuangKe(a.proyek, k)}
          </button>
        ))}
      </div>
      <button type="button" className={kelasTombol} onClick={a.tambahRuangBaru} disabled={n >= MAKS_RUANG}><Plus size={15} /> Ruangan</button>
      <input value={nama} onChange={e => a.namaiRuangKe(i, e.target.value)} placeholder={`Nama ruangan ${i + 1}`} aria-label="Nama ruangan yang dibuka"
        className="h-9 w-52 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-800" />
      <button type="button" className={kelasTombol} onClick={() => a.duplikatRuangKe(i)} disabled={n >= MAKS_RUANG} title="Salin ruangan ini beserta perangkat, kabel, teks, area & isian BOQ">
        <CopyPlus size={15} /> Duplikat ruangan
      </button>
      {n > 1 && (
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => konfirmasi({
          message: `Hapus ${namaRuangKe(a.proyek, i)}?`, description: 'Semua perangkat, kabel & teks di ruangan ini ikut terhapus. Bisa dibatalkan dengan Ctrl+Z.',
          confirmLabel: 'Hapus ruangan', danger: true, onConfirm: () => a.hapusRuangKe(i),
        })}><Trash2 size={15} /> Hapus ruangan</button>
      )}
      <span className="text-[11.5px] text-slate-500">Tiap ruangan punya Sheet 1 &amp; 2 sendiri; BOQ (Sheet 3) memuat semua ruangan per section.</span>
    </section>
  );
}
