'use client';
import { useEffect, useMemo, useState } from 'react';

export const BARIS_PER_HALAMAN = 15;

export interface HasilPaginasi<T> {
  halaman: number;
  setHalaman: (n: number) => void;
  totalHalaman: number;
  potongan: T[];
  mulai: number;
  total: number;
  perHalaman: number;
}

export function usePaginasi<T>(daftar: T[], perHalaman = BARIS_PER_HALAMAN): HasilPaginasi<T> {
  const [halaman, setHalaman] = useState(1);
  const total = daftar.length;
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));

  useEffect(() => {
    if (halaman > totalHalaman) setHalaman(1);
  }, [halaman, totalHalaman]);

  const halamanAman = Math.min(halaman, totalHalaman);
  const mulai = (halamanAman - 1) * perHalaman;
  const potongan = useMemo(
    () => daftar.slice(mulai, mulai + perHalaman),
    [daftar, mulai, perHalaman],
  );

  return { halaman: halamanAman, setHalaman, totalHalaman, potongan, mulai, total, perHalaman };
}

export function Paginasi({
  halaman, setHalaman, totalHalaman, mulai, total, perHalaman,
  satuan = 'baris', warna = '#dc2626',
}: {
  halaman: number;
  setHalaman: (n: number) => void;
  totalHalaman: number;
  mulai: number;
  total: number;
  perHalaman: number;
  satuan?: string;
  warna?: string;
}) {
  const tombolHalaman = useMemo(() => {
    const maks = Math.min(5, totalHalaman);
    return Array.from({ length: maks }, (_, i) => {
      if (totalHalaman <= 5) return i + 1;
      if (halaman <= 3) return i + 1;
      if (halaman >= totalHalaman - 2) return totalHalaman - 4 + i;
      return halaman - 2 + i;
    });
  }, [halaman, totalHalaman]);

  const akhir = Math.min(mulai + perHalaman, total);

  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-200 flex-wrap gap-2"
      style={{ background: 'rgba(255,255,255,0.97)' }}>
      <span className="text-xs text-gray-500">
        {total > 0 ? `${mulai + 1}–${akhir}` : '0'} dari {total} {satuan}
      </span>

      {totalHalaman > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Halaman pertama" title="Halaman pertama"
            onClick={() => setHalaman(1)} disabled={halaman === 1}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">«</button>
          <button type="button" onClick={() => setHalaman(Math.max(1, halaman - 1))} disabled={halaman === 1}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">‹ Prev</button>

          <div className="flex items-center gap-1">
            {tombolHalaman.map(n => (
              <button key={n} type="button" onClick={() => setHalaman(n)}
                aria-label={`Halaman ${n}`} aria-current={halaman === n ? 'page' : undefined}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  halaman === n ? 'text-white border-0' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                style={halaman === n ? { background: warna } : {}}>
                {n}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setHalaman(Math.min(totalHalaman, halaman + 1))} disabled={halaman === totalHalaman}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">Next ›</button>
          <button type="button" aria-label="Halaman terakhir" title="Halaman terakhir"
            onClick={() => setHalaman(totalHalaman)} disabled={halaman === totalHalaman}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">»</button>
        </div>
      )}

      <span className="text-xs text-gray-500">Hal. {halaman}/{totalHalaman}</span>
    </div>
  );
}
