'use client';
/**
 * "+ dari Pustaka…" - pilih entri pustaka satu jenis untuk mengisi kalkulator. Tidak tampil bila
 * pustaka jenis itu kosong / gagal dimuat (kalkulator tetap bisa diisi manual).
 */
import type { EntriPustaka } from '@/lib/pustaka';
import { usePustaka } from './usePustaka';

export function PilihPustaka({ jenis, onPilih, label = 'Isi dari Pustaka', saring }: {
  jenis: string; onPilih: (e: EntriPustaka) => void; label?: string; saring?: (e: EntriPustaka) => boolean;
}) {
  const { entri } = usePustaka(jenis);
  const daftar = saring ? entri.filter(saring) : entri;
  if (!daftar.length) return null;
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">📚 {label}</span>
      <select value="" onChange={e => { const x = daftar.find(d => d.id === e.target.value); if (x) onPilih(x); }}
        className="w-full rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2 text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200">
        <option value="">Pilih produk / data…</option>
        {daftar.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
      </select>
    </label>
  );
}
