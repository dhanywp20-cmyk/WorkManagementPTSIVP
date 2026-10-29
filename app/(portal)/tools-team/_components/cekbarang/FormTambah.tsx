'use client';
/**
 * Tambah barang cepat: nama (+ merk / tipe, qty, satuan) -> Enter -> masuk daftar, kursor kembali ke nama.
 * Satuan terakhir dipertahankan supaya mengetik banyak barang sejenis lebih cepat.
 */
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ItemBarang } from '@/lib/checklist-barang';

const kelasIsian = 'min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-base sm:text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const SATUAN_UMUM = ['pcs', 'unit', 'set', 'buah', 'roll', 'meter', 'box', 'pack', 'lot', 'ls'];

export function FormTambah({ onTambah, penuh, autoFocus }: {
  onTambah: (isi: Pick<ItemBarang, 'nama' | 'spek' | 'qty' | 'satuan'>) => void; penuh: boolean; autoFocus?: boolean;
}) {
  const [isi, setIsi] = useState({ nama: '', spek: '', qty: '', satuan: '' });
  const nama = useRef<HTMLInputElement>(null);
  const ubah = (p: Partial<typeof isi>) => setIsi(x => ({ ...x, ...p }));

  const kirim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isi.nama.trim() || penuh) { nama.current?.focus(); return; }
    onTambah({ nama: isi.nama.trim(), spek: isi.spek.trim(), qty: isi.qty.trim(), satuan: isi.satuan.trim() });
    setIsi(x => ({ nama: '', spek: '', qty: '', satuan: x.satuan }));
    nama.current?.focus();
  };

  return (
    <form onSubmit={kirim} aria-label="Tambah barang"
      className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2">
      <input ref={nama} value={isi.nama} onChange={e => ubah({ nama: e.target.value })} autoFocus={autoFocus} maxLength={500}
        placeholder="Nama barang baru" aria-label="Nama barang baru" className={`${kelasIsian} flex-1 basis-full sm:basis-40`} />
      <input value={isi.spek} onChange={e => ubah({ spek: e.target.value })} maxLength={500}
        placeholder="Merk / tipe" aria-label="Merk / tipe barang baru" className={`${kelasIsian} basis-full sm:basis-auto sm:w-44`} />
      <input value={isi.qty} onChange={e => ubah({ qty: e.target.value })} maxLength={40} inputMode="decimal"
        placeholder="Qty" aria-label="Qty barang baru" className={`${kelasIsian} w-16 tabular-nums`} />
      <input value={isi.satuan} onChange={e => ubah({ satuan: e.target.value })} maxLength={40} list="cek-barang-satuan"
        placeholder="Satuan" aria-label="Satuan barang baru" className={`${kelasIsian} w-24`} />
      <datalist id="cek-barang-satuan">{SATUAN_UMUM.map(s => <option key={s} value={s} />)}</datalist>
      <button type="submit" disabled={!isi.nama.trim() || penuh} title={penuh ? 'Daftar sudah penuh' : 'Tambah ke daftar (Enter)'}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 shrink-0">
        <Plus size={15} /> Tambah
      </button>
    </form>
  );
}
