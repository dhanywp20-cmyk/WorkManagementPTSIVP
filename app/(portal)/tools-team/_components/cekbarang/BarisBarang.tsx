'use client';
/** Satu baris daftar Checklist Barang: mode cek (✓ / ✗ + keterangan) atau mode ubah daftar (isian + hapus). */
import { memo } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import type { ItemBarang, StatusCek } from '@/lib/checklist-barang';

const kelasIsian = 'min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-base sm:text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

/** Kolom grid baris (mode cek) - dipakai juga kepala tabel di ChecklistBarang. */
export const GRID_CEK = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[2rem_minmax(0,1fr)_6.5rem_5.75rem_minmax(0,15rem)] gap-x-3';

export const BarisBarang = memo(function BarisBarang({ it, no, ubah, fokus, onUbah, onHapus }: {
  it: ItemBarang; no: number; ubah: boolean; fokus: boolean;
  onUbah: (id: string, p: Partial<ItemBarang>) => void; onHapus: (id: string) => void;
}) {
  if (ubah) {
    return (
      <li className={`flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2 ${it.grup ? 'bg-slate-50' : ''}`}>
        <span className="w-7 shrink-0 text-center text-[12px] tabular-nums text-slate-500">{it.grup ? '—' : no}</span>
        <input value={it.nama} onChange={e => onUbah(it.id, { nama: e.target.value })} autoFocus={fokus}
          placeholder={it.grup ? 'Judul kelompok' : 'Nama barang'} aria-label="Nama barang"
          className={`${kelasIsian} flex-1 basis-40 ${it.grup ? 'font-bold' : ''}`} />
        {!it.grup && (
          <>
            <input value={it.spek} onChange={e => onUbah(it.id, { spek: e.target.value })} placeholder="Merk / tipe" aria-label="Merk / tipe"
              className={`${kelasIsian} basis-full sm:basis-auto sm:w-44 ml-9 sm:ml-0`} />
            <input value={it.qty} onChange={e => onUbah(it.id, { qty: e.target.value })} placeholder="Qty" aria-label="Qty" inputMode="decimal"
              className={`${kelasIsian} w-20 tabular-nums ml-9 sm:ml-0`} />
            <input value={it.satuan} onChange={e => onUbah(it.id, { satuan: e.target.value })} placeholder="Satuan" aria-label="Satuan"
              className={`${kelasIsian} w-24`} />
          </>
        )}
        <button type="button" onClick={() => onHapus(it.id)} title="Hapus baris" aria-label={`Hapus ${it.nama || 'baris'}`}
          className="ml-auto sm:ml-0 w-9 h-9 shrink-0 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
          <Trash2 size={16} />
        </button>
      </li>
    );
  }

  if (it.grup) {
    return <li className="px-3 py-2 bg-slate-100 text-[12px] font-bold uppercase tracking-wide text-slate-700 break-words">{it.nama}</li>;
  }

  const jumlah = [it.qty, it.satuan].filter(Boolean).join(' ') || '-';
  const atur = (s: StatusCek) => onUbah(it.id, { status: it.status === s ? '' : s });
  return (
    <li className={`${GRID_CEK} gap-y-1.5 items-center px-3 py-2.5 ${it.status === 'ok' ? 'bg-emerald-50/60' : it.status === 'tidak' ? 'bg-rose-50/70' : ''}`}>
      <span className="text-center text-[12px] tabular-nums text-slate-500">{no}</span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-slate-900 break-words leading-snug">{it.nama || '-'}</p>
        {it.spek && <p className="text-[11.5px] text-slate-500 break-words">{it.spek}</p>}
        <p className="sm:hidden text-[11.5px] text-slate-600 tabular-nums">Qty: {jumlah}</p>
      </div>
      <span className="hidden sm:block text-[13px] tabular-nums text-slate-700 break-words">{jumlah}</span>
      <div className="flex gap-1.5 justify-end sm:justify-center" role="group" aria-label={`Hasil cek ${it.nama}`}>
        <button type="button" onClick={() => atur('ok')} aria-pressed={it.status === 'ok'} title="Sesuai / ada"
          className={`w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-lg border transition-colors ${it.status === 'ok' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-700 hover:border-emerald-300'}`}>
          <Check size={18} strokeWidth={2.75} />
        </button>
        <button type="button" onClick={() => atur('tidak')} aria-pressed={it.status === 'tidak'} title="Tidak sesuai / tidak ada"
          className={`w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-lg border transition-colors ${it.status === 'tidak' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-rose-700 hover:border-rose-300'}`}>
          <X size={18} strokeWidth={2.75} />
        </button>
      </div>
      <input value={it.ket} onChange={e => onUbah(it.id, { ket: e.target.value })} aria-label={`Keterangan ${it.nama}`}
        placeholder={it.status === 'tidak' ? 'Kenapa? (kurang 1, rusak, ...)' : 'Keterangan'}
        className={`${kelasIsian} col-start-2 col-span-2 sm:col-start-auto sm:col-span-1 w-full ${it.status === 'tidak' && !it.ket ? 'border-rose-200' : ''}`} />
    </li>
  );
});
