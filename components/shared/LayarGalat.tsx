'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert, House } from 'lucide-react';
import { bolehMuatUlang, galatBerkasTidakTermuat, KUNCI_MUAT_ULANG } from '@/lib/galat-berkas';
import { laporGalat } from '@/lib/lapor-galat';

/**
 * Layar galat yang dipakai app/error.tsx, app/global-error.tsx, dan app/(portal)/error.tsx.
 *
 * Sebelum ini tidak ada batas galat sama sekali: satu galat render di modul mana pun
 * menjatuhkan seluruh halaman menjadi layar putih (pernah terjadi di Incentive PTS).
 * Sekarang galat hanya menjatuhkan bagian yang rusak; menu dan header portal tetap hidup.
 */
export function LayarGalat({ error, reset, penuh = false }: {
  error: Error & { digest?: string };
  reset: () => void;
  /** true = menutupi seluruh layar (dipakai global-error, tanpa kerangka portal). */
  penuh?: boolean;
}) {
  useEffect(() => {
    console.error('[galat-halaman]', error);
    laporGalat({ pesan: `${error.name && error.name !== 'Error' ? `${error.name}: ` : ''}${error.message}`, sumber: 'halaman', digest: error.digest });
    //  Galat berkas lama sesudah deploy: muat ulang diam-diam (paling sering sekali per menit).
    if (galatBerkasTidakTermuat(error)) {
      try {
        if (bolehMuatUlang(sessionStorage.getItem(KUNCI_MUAT_ULANG), Date.now())) {
          sessionStorage.setItem(KUNCI_MUAT_ULANG, String(Date.now()));
          window.location.reload();
        }
      } catch { /* sessionStorage ditolak - biarkan tombol manual */ }
    }
  }, [error]);

  return (
    <div role="alert" className={`flex items-center justify-center p-6 ${penuh ? 'min-h-screen bg-slate-50' : 'min-h-[60vh]'}`}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-rose-100 p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
          <TriangleAlert className="w-6 h-6 text-rose-600" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Halaman ini mengalami kendala</h2>
        <p className="text-xs text-slate-500 mt-1">Data Anda aman. Coba muat ulang.</p>
        <div className="mt-5 flex gap-2 justify-center">
          <button type="button" onClick={() => reset()} aria-label="Coba lagi" title="Coba lagi"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700">
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Coba lagi
          </button>
          <a href="/dashboard" aria-label="Ke Dashboard" title="Ke Dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">
            <House className="w-4 h-4" aria-hidden="true" /> Dashboard
          </a>
        </div>
        {error.digest && <p className="mt-4 text-[11px] text-slate-400">Kode: {error.digest}</p>}
      </div>
    </div>
  );
}
