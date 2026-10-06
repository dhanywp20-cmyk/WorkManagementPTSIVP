'use client';
/** Sel isian & tombol kecil tabel referensi LED. */
import { Ikon } from '@/components/shared/Ikon';
import { BRAND_UMUM } from '@/lib/av-hitung';
import { useState } from 'react';

export const sel = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

export function SelAngka({ nilai, onUbah, lebar = 'w-20', label }: { nilai: number; onUbah: (v: number) => void; lebar?: string; label: string }) {
  const [teks, setTeks] = useState<string | null>(null);
  return (
    <input type="number" inputMode="decimal" aria-label={label} value={teks ?? String(nilai)}
      onChange={e => { setTeks(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0) onUbah(v); }}
      onBlur={() => setTeks(null)} className={`${sel} ${lebar}`} />
  );
}

export function SelTeks({ nilai, onUbah, lebar = 'w-28', label }: { nilai: string; onUbah: (v: string) => void; lebar?: string; label: string }) {
  return <input type="text" aria-label={label} value={nilai} onChange={e => onUbah(e.target.value)} className={`${sel} ${lebar}`} />;
}

/** Nama brand: disimpan saat selesai mengetik (blur / Enter) supaya modulnya tidak ikut berpindah tiap huruf. */
export function NamaBrand({ nilai, onSimpan }: { nilai: string; onSimpan: (v: string) => void }) {
  const [teks, setTeks] = useState<string | null>(null);
  const simpan = () => { if (teks !== null && teks.trim() && teks.trim() !== nilai) onSimpan(teks.trim()); setTeks(null); };
  return (
    <input type="text" aria-label="Nama brand" value={teks ?? nilai} maxLength={60} disabled={nilai === BRAND_UMUM}
      onChange={e => setTeks(e.target.value)} onBlur={simpan} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={`${sel} w-36 font-semibold disabled:bg-slate-50 disabled:text-slate-500`} />
  );
}

export function Hapus({ onKlik, label }: { onKlik: () => void; label: string }) {
  return (
    <button type="button" onClick={onKlik} aria-label={label} title={label}
      className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50">
      <Ikon nama="🗑" ukuran={15} />
    </button>
  );
}

export const th = 'px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap';

export const td = 'px-1.5 py-1 align-middle';

export function Tambah({ onKlik, teks }: { onKlik: () => void; teks: string }) {
  return (
    <button type="button" onClick={onKlik}
      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-blue-700 hover:bg-blue-50">
      + {teks}
    </button>
  );
}
