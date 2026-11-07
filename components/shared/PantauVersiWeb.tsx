'use client';
import { useEffect, useState } from 'react';
import { Ikon } from './Ikon';
import { adaVersiBaru, perluPeriksa } from '@/lib/versi-web';

const KOMIT_HALAMAN = process.env.NEXT_PUBLIC_KOMIT_APP || '';

export function PantauVersiWeb() {
  const [baru, setBaru] = useState(false);

  useEffect(() => {
    if (!KOMIT_HALAMAN) return;
    let tersembunyiSejak: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    let sibuk = false;
    const periksa = async () => {
      if (sibuk) return;
      sibuk = true;
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        const j = r.ok ? await r.json() as { komit?: string | null } : null;
        if (adaVersiBaru(KOMIT_HALAMAN, j?.komit)) setBaru(true);
      } catch {  } finally { sibuk = false; }
    };
    const ubahTampak = () => {
      if (document.visibilityState === 'hidden') { tersembunyiSejak = Date.now(); return; }
      if (perluPeriksa(tersembunyiSejak, Date.now())) void periksa();
      tersembunyiSejak = null;
    };
    const kembaliDariAplikasi = () => { void periksa(); };
    document.addEventListener('visibilitychange', ubahTampak);
    window.addEventListener('wm-kembali', kembaliDariAplikasi);
    return () => {
      document.removeEventListener('visibilitychange', ubahTampak);
      window.removeEventListener('wm-kembali', kembaliDariAplikasi);
    };
  }, []);

  if (!baru) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-2400 p-3 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><Ikon nama="🔄" ukuran={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">Versi baru tersedia</p>
          <p className="text-[11px] text-slate-500">Muat ulang untuk memakai perbaikan terbaru.</p>
        </div>
        <button type="button" onClick={() => setBaru(false)} className="px-2.5 py-2 rounded-xl text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">Nanti</button>
        <button type="button" onClick={() => location.reload()} className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-[12.5px] font-bold">Muat ulang</button>
      </div>
    </div>
  );
}
