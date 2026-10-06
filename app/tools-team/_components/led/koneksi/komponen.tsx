'use client';
/** Komponen kecil Screen Connection: ikon pola S/Z, isian angka ringkas, kelas tombol & judul. */
import { hitungKoneksi, type SudutMulai } from '@/lib/av-hitung';
import { useState } from 'react';

/** Ikon pola kabel 3×3 (S/Z) dari pojok & arah - seperti tombol koneksi cepat NovaLCT. */
export function IkonPola({ mulai, arah, pola }: { mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z' }) {
  const h = hitungKoneksi({ kolom: 3, baris: 3, pxPerRC: 1, pxPerPort: 100, mulai, arah, pola, bagi: 'penuh' });
  const titik = h.sel.map(s => `${6 + s.c * 10},${6 + s.r * 10}`).join(' ');
  const a = h.sel[0];
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
      <polyline points={titik} fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={6 + a.c * 10} cy={6 + a.r * 10} r="2.6" fill="#16a34a" />
    </svg>
  );
}

/** Isian angka kecil (untuk deret lebar kolom / tinggi baris). */
export function AngkaKecil({ nilai, onUbah, label }: { nilai: number; onUbah: (v: number) => void; label: string }) {
  const [teks, setTeks] = useState<string | null>(null);
  return (
    <input type="number" inputMode="numeric" min={1} step={1} aria-label={label} title={label}
      value={teks ?? String(nilai)}
      onChange={e => { setTeks(e.target.value); const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 8192) onUbah(v); }}
      onBlur={() => setTeks(null)}
      className="w-[64px] shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[12px] tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
  );
}

export const kelasTombol = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent';

export const kelasJudul = 'text-[11px] font-bold uppercase tracking-wider text-slate-600';
