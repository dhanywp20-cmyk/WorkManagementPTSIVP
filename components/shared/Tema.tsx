'use client';
import { useEffect, useSyncExternalStore } from 'react';

/* Pilihan tampilan: Glass / Matte (kelas html.gaya-matte). Mode gelap sudah tidak dipakai.
   - Glass = tampilan bingkai hangat beraksen merah; Matte = bingkai navy + kartu beraksen biru
     (tema-aksen-biru.css).
   - Desktop memilih lewat tombol di sidebar; HP lewat tombol di nav bawah. Pilihan disimpan di
     localStorage (per perangkat).
   - Belum memilih: HP = Matte; desktop mengikuti "Tampilan bawaan desktop" di Admin Panel.
   - Bilah status (meta theme-color, dan bilah status APK lewat AndroidApp.warnaBilah) ikut warna
     tampilan supaya menyatu dengan header. */
export const KUNCI_TEMA = 'wm-tema';
export const KUNCI_GAYA = 'wm-gaya';
/** Gaya bawaan desktop dari Admin Panel > Dashboard Setting (ditulis lib/merek/inti.ts). */
export const KUNCI_GAYA_BAWAAN = 'wm-gaya-bawaan';
const KELAS = 'gelap';
const KELAS_MATTE = 'gaya-matte';
const LEBAR_HP = '(max-width: 767px)';

/** Warna bilah status per tampilan: navy bingkai Matte, merah header Glass. */
export const WARNA_BILAH = { matte: '#0f2559', glass: '#e11d48' } as const;

export const SKRIP_TEMA_AWAL = `try{var d=document.documentElement,h=matchMedia('${LEBAR_HP}').matches,l=localStorage,g=l.getItem('${KUNCI_GAYA}');if(h?g!=='glass':(g||l.getItem('${KUNCI_GAYA_BAWAAN}'))==='matte')d.classList.add('${KELAS_MATTE}')}catch(e){}`;

const sedangGelap = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KELAS);
const sedangMatte = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KELAS_MATTE);
const layarHp = () => typeof window !== 'undefined' && window.matchMedia(LEBAR_HP).matches;
const baca = (kunci: string) => { try { return localStorage.getItem(kunci); } catch { return null; } };

function terapkan(gelap: boolean) {
  document.documentElement.classList.toggle(KELAS, gelap);
  document.documentElement.style.colorScheme = gelap ? 'dark' : '';
  window.dispatchEvent(new CustomEvent('wm-tema', { detail: gelap }));
}

type JendelaApk = Window & { AndroidApp?: { warnaBilah?: (hex: string) => void } };

/** Bilah status mengikuti tampilan: meta theme-color (browser HP) & bilah status APK 1.0.5+. */
function setelBilah(matte: boolean) {
  const warna = matte ? WARNA_BILAH.matte : WARNA_BILAH.glass;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', warna));
  try { (window as JendelaApk).AndroidApp?.warnaBilah?.(warna); } catch {}
}

function terapkanGaya(matte: boolean) {
  document.documentElement.classList.toggle(KELAS_MATTE, matte);
  setelBilah(matte);
  window.dispatchEvent(new CustomEvent('wm-gaya', { detail: matte }));
}

/** Samakan kelas html dengan pilihan tersimpan & lebar layar (dipanggil saat awal, ganti lebar, atau tab lain mengubah). */
function selaraskan() {
  if (sedangGelap()) terapkan(false);
  const pilihan = baca(KUNCI_GAYA);
  const matte = layarHp() ? pilihan !== 'glass' : (pilihan ?? baca(KUNCI_GAYA_BAWAAN)) === 'matte';
  if (matte !== sedangMatte()) terapkanGaya(matte);
  else setelBilah(matte);
}

export function kembaliTerang() {
  try { localStorage.removeItem(KUNCI_TEMA); } catch {}
  if (typeof document !== 'undefined' && sedangGelap()) terapkan(false);
}

export function PenyelarasTema() {
  useEffect(() => {
    selaraskan();
    const dariTabLain = (e: StorageEvent) => { if (e.key === KUNCI_TEMA || e.key === KUNCI_GAYA || e.key === KUNCI_GAYA_BAWAAN) selaraskan(); };
    const mq = window.matchMedia(LEBAR_HP);
    window.addEventListener('storage', dariTabLain);
    window.addEventListener(KUNCI_GAYA_BAWAAN, selaraskan);
    mq.addEventListener('change', selaraskan);
    return () => {
      window.removeEventListener('storage', dariTabLain);
      window.removeEventListener(KUNCI_GAYA_BAWAAN, selaraskan);
      mq.removeEventListener('change', selaraskan);
    };
  }, []);
  return null;
}

const langgananGaya = (ubah: () => void) => {
  window.addEventListener('wm-gaya', ubah);
  return () => window.removeEventListener('wm-gaya', ubah);
};

/** Gaya Glass / Matte (tombol di sidebar desktop & nav bawah HP). Mengembalikan [matte, tukar]. */
export function useGaya(): [boolean, () => void] {
  const matte = useSyncExternalStore(langgananGaya, sedangMatte, () => false);
  const tukar = () => {
    const baru = !sedangMatte();
    try { localStorage.setItem(KUNCI_GAYA, baru ? 'matte' : 'glass'); } catch {}
    terapkanGaya(baru);
  };
  return [matte, tukar];
}

/** Ikon gaya: Matte = lingkaran setengah padat, Glass = panel kaca berkilau. */
export function IkonGaya({ matte, className = 'w-4 h-4' }: { matte: boolean; className?: string }) {
  return matte ? (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" strokeWidth={2} />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  ) : (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M8 15l5-6M12 15.5l3-3.5" />
    </svg>
  );
}
