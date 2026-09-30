'use client';
import { useEffect, useState } from 'react';
import { Ikon } from './Ikon';
import { ambilRilisTerbaru, formatUkuran, kodeVersiAplikasi, URL_UNDUH_APK, type RilisAndroid } from '@/lib/rilis-android';

const KUNCI_DILEWATI = 'wm_apk_dilewati';

/**
 * Hanya di dalam aplikasi Android: bila admin menerbitkan APK dengan kode
 * versi lebih tinggi dari yang terpasang, tampilkan ajakan update.
 * Rilis bertanda Wajib -> layar penuh tanpa tombol tutup.
 * Di peramban biasa tidak memanggil apa pun (nol egress).
 */
export function PembaruanAndroid() {
  const [rilis, setRilis] = useState<RilisAndroid | null>(null);

  useEffect(() => {
    const terpasang = kodeVersiAplikasi();
    if (terpasang === null || location.pathname.startsWith('/login')) return;
    let hidup = true;
    ambilRilisTerbaru().then(r => {
      if (!hidup || !r || r.kode_versi <= terpasang) return;
      let dilewati = 0;
      try { dilewati = Number(localStorage.getItem(KUNCI_DILEWATI)) || 0; } catch { /* abaikan */ }
      if (!r.wajib && dilewati >= r.kode_versi) return;
      setRilis(r);
    });
    return () => { hidup = false; };
  }, []);

  if (!rilis) return null;

  const lewati = () => {
    try { localStorage.setItem(KUNCI_DILEWATI, String(rilis.kode_versi)); } catch { /* abaikan */ }
    setRilis(null);
  };

  const isi = (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-sm">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Ikon nama="📲" ukuran={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">
            {rilis.wajib ? 'Update wajib tersedia' : 'Versi baru tersedia'} · v{rilis.versi}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {rilis.wajib ? 'Versi aplikasi ini sudah tidak didukung. Pasang versi baru untuk melanjutkan.' : 'Pasang untuk mendapat perbaikan terbaru.'}
          </p>
          {rilis.catatan && <p className="text-[11px] text-slate-600 mt-2 whitespace-pre-line line-clamp-4">{rilis.catatan}</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {!rilis.wajib && (
          <button type="button" onClick={lewati}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Nanti
          </button>
        )}
        <a href={URL_UNDUH_APK}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5">
          <Ikon nama="⬇" ukuran={15} /> Update ({formatUkuran(rilis.ukuran)})
        </a>
      </div>
    </div>
  );

  return rilis.wajib ? (
    <div role="alertdialog" aria-modal="true" aria-label="Update aplikasi wajib"
      className="fixed inset-0 z-[3000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      {isi}
    </div>
  ) : (
    <div role="dialog" aria-label="Update aplikasi" className="fixed inset-x-0 bottom-0 z-[2500] p-3 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm">{isi}</div>
    </div>
  );
}
