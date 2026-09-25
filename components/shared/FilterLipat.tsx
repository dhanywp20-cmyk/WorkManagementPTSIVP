'use client';

import { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';

/**
 * Baris filter yang DILIPAT di ponsel.
 *
 * Di layar lebar semua filter tampil seperti biasa. Di ponsel hanya isian
 * PERTAMA (pencarian) yang tampil; sisanya di balik tombol "Filter lainnya"
 * yang menunjukkan berapa filter sedang aktif. Dulu enam kolom filter
 * ditumpuk 2x3 di ponsel dan mendorong daftar datanya jauh ke bawah layar.
 *
 * `kelas` = kelas grid yang sama dengan sebelumnya, jadi tata letak desktop
 * tidak berubah. `aktif` = nilai-nilai filter; yang terisi & bukan 'all'
 * dihitung sebagai aktif (isian pertama/pencarian tidak ikut dihitung).
 */
export function FilterLipat({ kelas, aktif = [], children }: {
  kelas: string;
  aktif?: unknown[];
  children: React.ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  const KOSONG = new Set(['', 'all', 'semua', 'all status', 'all handlers']);
  const jumlah = aktif.filter(v => v !== undefined && v !== null
    && !(typeof v === 'string' && KOSONG.has(v.trim().toLowerCase()))
    && !(Array.isArray(v) && v.length === 0)).length;
  return (
    <>
      <div className={`${kelas} ${buka ? '' : 'filter-lipat-tutup'}`}>
        {children}
      </div>
      <button type="button" onClick={() => setBuka(b => !b)} aria-expanded={buka}
        className="sm:hidden mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600">
        <SlidersHorizontal size={15} aria-hidden="true" />
        {buka ? 'Sembunyikan filter' : 'Filter lainnya'}
        {jumlah > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-slate-900 text-white text-[11px] leading-5">{jumlah}</span>}
        <ChevronDown size={15} aria-hidden="true" className={`transition-transform ${buka ? 'rotate-180' : ''}`} />
      </button>
    </>
  );
}
