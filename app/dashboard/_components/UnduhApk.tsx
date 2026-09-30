'use client';
import { useEffect, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';
import { ambilRilisTerbaru, formatUkuran, kodeVersiAplikasi, URL_UNDUH_APK, type RilisAndroid } from '@/lib/rilis-android';

/**
 * Tombol unduh APK Android di Profil - selalu rilis TERBARU yang diunggah
 * admin (Admin Panel -> Aplikasi Android). Belum ada rilis -> tidak tampil.
 */
export function UnduhApk() {
  const [rilis, setRilis] = useState<RilisAndroid | null>(null);
  const [kodeTerpasang, setKodeTerpasang] = useState<number | null>(null);

  useEffect(() => {
    let hidup = true;
    setKodeTerpasang(kodeVersiAplikasi());
    ambilRilisTerbaru().then(r => { if (hidup) setRilis(r); });
    return () => { hidup = false; };
  }, []);

  if (!rilis) return null;
  const sudahTerbaru = kodeTerpasang !== null && kodeTerpasang >= rilis.kode_versi;

  return (
    <div className="space-y-2.5 pt-1">
      {sudahTerbaru ? (
        <p className="text-[11px] text-slate-500">Aplikasi Android di HP ini sudah versi terbaru (v{rilis.versi}).</p>
      ) : (
        <>
          <a href={URL_UNDUH_APK}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
            <Ikon nama="⬇" ukuran={16} />
            <span className="text-center leading-tight">{kodeTerpasang !== null ? 'Update' : 'Unduh'} Aplikasi (.apk) · v{rilis.versi} ({formatUkuran(rilis.ukuran)})</span>
          </a>
          <ol className="text-[11px] text-slate-500 leading-relaxed list-decimal pl-4 space-y-0.5">
            <li>Unduh berkas .apk di atas dari HP Android.</li>
            <li>Buka berkasnya, izinkan <strong>Instal aplikasi tidak dikenal</strong> bila diminta.</li>
            <li>Pasang, lalu masuk dengan akun yang sama. Izinkan notifikasi agar pemberitahuan berbunyi.</li>
          </ol>
          {rilis.catatan && (
            <details className="text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-600">Yang baru di v{rilis.versi}</summary>
              <p className="mt-1 whitespace-pre-line">{rilis.catatan}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
