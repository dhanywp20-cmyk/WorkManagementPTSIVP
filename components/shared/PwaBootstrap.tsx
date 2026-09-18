'use client';
import { useEffect, useState } from 'react';
import { daftarSW } from '@/lib/push-client';
import { statusInstalasiPWA, subscribeInstallPWA, pasangAplikasiPWA } from '@/lib/pwa-install';

const KUNCI_DITUTUP = 'wm_install_banner_ditutup';

/**
 * Dipasang sekali di root layout - dua pekerjaan lintas-halaman:
 *   1. Daftarkan service worker (syarat installability PWA + push notification)
 *      seawal mungkin, tidak menunggu pengguna membuka dashboard dulu.
 *   2. Tampilkan banner "Pasang aplikasi ini di HP" - tombol Install asli di
 *      Android/Chrome (event beforeinstallprompt, lihat lib/pwa-install.ts),
 *      petunjuk manual "Tambahkan ke Layar Utama" di iPhone/Safari (iOS tidak
 *      punya event itu sama sekali).
 *
 * Tidak tampil sama sekali kalau: sudah terpasang, sudah pernah ditutup
 * (localStorage - jangan menagih tiap kunjungan), atau di peramban yang tidak
 * mendukung install PWA dan bukan iOS Safari.
 */
export function PwaBootstrap() {
  const [tampilBanner, setTampilBanner] = useState(false);
  const [modeIOS, setModeIOS] = useState(false);

  useEffect(() => {
    void daftarSW();

    let sudahDitutup = false;
    try { sudahDitutup = localStorage.getItem(KUNCI_DITUTUP) === '1'; } catch { /* abaikan */ }
    if (sudahDitutup) return;

    const evaluasi = () => {
      const status = statusInstalasiPWA();
      if (status === 'terpasang') {
        setTampilBanner(false);
        try { localStorage.setItem(KUNCI_DITUTUP, '1'); } catch { /* abaikan */ }
        return;
      }
      if (status === 'ios') { setModeIOS(true); setTampilBanner(true); return; }
      if (status === 'siap') { setModeIOS(false); setTampilBanner(true); return; }
    };
    evaluasi();
    return subscribeInstallPWA(evaluasi);
  }, []);

  const tutup = () => {
    setTampilBanner(false);
    try { localStorage.setItem(KUNCI_DITUTUP, '1'); } catch { /* abaikan */ }
  };

  const install = async () => {
    await pasangAplikasiPWA();
    setTampilBanner(false);
  };

  if (!tampilBanner) return null;

  return (
    <div role="dialog" aria-label="Pasang aplikasi ke HP"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-[2000] rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
      style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(225,29,72,0.25)' }}>
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)' }}>📲</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 leading-tight">Pasang aplikasi ini di HP</p>
          {modeIOS ? (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Tap ikon <strong>Share</strong> (kotak dengan panah ke atas) di Safari,
              lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong>.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Akses lebih cepat + notifikasi langsung ke HP, seperti aplikasi biasa.
            </p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            {!modeIOS && (
              <button onClick={install}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)' }}>
                Install
              </button>
            )}
            <button onClick={tutup}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all">
              {modeIOS ? 'Mengerti' : 'Nanti saja'}
            </button>
          </div>
        </div>
        <button aria-label="Tutup" onClick={tutup}
          className="text-slate-300 hover:text-slate-500 text-sm flex-shrink-0 -mt-0.5">✕</button>
      </div>
    </div>
  );
}
