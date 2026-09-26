'use client';
import { useEffect, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';

/**
 * Tombol unduh APK Android di Profil. Berkasnya satu nama tetap
 * (public/android/work-management.apk) yang ditimpa CI tiap rilis, jadi yang
 * tampil selalu versi terbaru; versi.json ditulis CI bersamaan.
 * Belum ada rilis (versi.json tidak ada) -> tidak tampil apa pun.
 */
type Versi = { versionName: string; versionCode: number; ukuran: number; dirilis: string };

export function UnduhApk() {
  const [versi, setVersi] = useState<Versi | null>(null);

  useEffect(() => {
    let hidup = true;
    fetch('/android/versi.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (hidup && j?.versionName) setVersi(j as Versi); })
      .catch(() => { /* belum ada rilis */ });
    return () => { hidup = false; };
  }, []);

  if (!versi) return null;
  const mb = (versi.ukuran / 1024 / 1024).toFixed(1);
  const tanggal = new Date(versi.dirilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <a href={`/android/work-management.apk?v=${versi.versionCode}`} download="work-management.apk"
      className="flex items-center gap-3 w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all">
      <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <Ikon nama="⬇" ukuran={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-700">Unduh APK Android</span>
        <span className="block text-[11px] text-slate-400">v{versi.versionName} · {mb} MB · {tanggal}</span>
      </span>
    </a>
  );
}
