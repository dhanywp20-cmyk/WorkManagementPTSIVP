'use client';
import { useEffect, useState } from 'react';
import { daftarSW } from '@/lib/push-client';

const KUNCI_DITUTUP = 'wm_install_banner_ditutup';

/** true bila aplikasi SEDANG berjalan sebagai PWA terpasang (bukan tab peramban biasa). */
function sudahTerpasang(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari lama belum punya display-mode media query - pakai properti khususnya.
  return !!(window.navigator as any).standalone;
}

function iOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && safari;
}

/**
 * Dipasang sekali di root layout - dua pekerjaan lintas-halaman:
 *   1. Daftarkan service worker (syarat installability PWA + push notification)
 *      seawal mungkin, tidak menunggu pengguna membuka dashboard dulu.
 *   2. Tampilkan banner "Pasang aplikasi ini di HP" - tombol Install asli di
 *      Android/Chrome (event beforeinstallprompt), petunjuk manual "Tambahkan
 *      ke Layar Utama" di iPhone/Safari (iOS tidak punya event itu sama sekali).
 *
 * Tidak tampil sama sekali kalau: sudah terpasang, sudah pernah ditutup
 * (localStorage - jangan menagih tiap kunjungan), atau di peramban yang tidak
 * mendukung install PWA dan bukan iOS Safari.
 */
export function PwaBootstrap() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [tampilBanner, setTampilBanner] = useState(false);
  const [modeIOS, setModeIOS] = useState(false);

  useEffect(() => {
    void daftarSW();

    if (sudahTerpasang()) return;
    let sudahDitutup = false;
    try { sudahDitutup = localStorage.getItem(KUNCI_DITUTUP) === '1'; } catch { /* abaikan */ }
    if (sudahDitutup) return;

    if (iOSSafari()) {
      setModeIOS(true);
      setTampilBanner(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e);
      setTampilBanner(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const onInstalled = () => { setTampilBanner(false); try { localStorage.setItem(KUNCI_DITUTUP, '1'); } catch { /* abaikan */ } };
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const tutup = () => {
    setTampilBanner(false);
    try { localStorage.setItem(KUNCI_DITUTUP, '1'); } catch { /* abaikan */ }
  };

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
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
