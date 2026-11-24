'use client';
import { useEffect, useSyncExternalStore } from 'react';

/* Dua pilihan tampilan:
   - Mode gelap (kelas html.gelap): hanya di HP (< 768px), lewat tombol di nav bawah.
   - Gaya Glass / Matte (kelas html.gaya-matte): Glass = tampilan bingkai hangat (bawaan desktop),
     Matte = bingkai navy + kartu beraksen biru (tema-aksen-biru.css). HP selalu Matte;
     desktop memilih lewat tombol di sidebar (menggantikan tombol mode gelap). */
export const KUNCI_TEMA = 'wm-tema';
export const KUNCI_GAYA = 'wm-gaya';
const KELAS = 'gelap';
const KELAS_MATTE = 'gaya-matte';
const LEBAR_HP = '(max-width: 767px)';

export const SKRIP_TEMA_AWAL = `try{var d=document.documentElement,h=matchMedia('${LEBAR_HP}').matches;if(h&&localStorage.getItem('${KUNCI_TEMA}')==='gelap')d.classList.add('${KELAS}');if(h||localStorage.getItem('${KUNCI_GAYA}')==='matte')d.classList.add('${KELAS_MATTE}')}catch(e){}`;

const sedangGelap = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KELAS);
const sedangMatte = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KELAS_MATTE);
const layarHp = () => typeof window !== 'undefined' && window.matchMedia(LEBAR_HP).matches;
const baca = (kunci: string) => { try { return localStorage.getItem(kunci); } catch { return null; } };

function terapkan(gelap: boolean) {
  document.documentElement.classList.toggle(KELAS, gelap);
  document.documentElement.style.colorScheme = gelap ? 'dark' : '';
  window.dispatchEvent(new CustomEvent('wm-tema', { detail: gelap }));
}

function terapkanGaya(matte: boolean) {
  document.documentElement.classList.toggle(KELAS_MATTE, matte);
  window.dispatchEvent(new CustomEvent('wm-gaya', { detail: matte }));
}

/** Samakan kelas html dengan pilihan tersimpan & lebar layar (dipanggil saat awal, ganti lebar, atau tab lain mengubah). */
function selaraskan() {
  const hp = layarHp();
  const gelap = hp && baca(KUNCI_TEMA) === 'gelap';
  if (gelap !== sedangGelap()) terapkan(gelap);
  else if (gelap) document.documentElement.style.colorScheme = 'dark';
  const matte = hp || baca(KUNCI_GAYA) === 'matte';
  if (matte !== sedangMatte()) terapkanGaya(matte);
}

export function kembaliTerang() {
  try { localStorage.removeItem(KUNCI_TEMA); } catch {}
  if (typeof document !== 'undefined' && sedangGelap()) terapkan(false);
}

export function PenyelarasTema() {
  useEffect(() => {
    selaraskan();
    const dariTabLain = (e: StorageEvent) => { if (e.key === KUNCI_TEMA || e.key === KUNCI_GAYA) selaraskan(); };
    const mq = window.matchMedia(LEBAR_HP);
    window.addEventListener('storage', dariTabLain);
    mq.addEventListener('change', selaraskan);
    return () => { window.removeEventListener('storage', dariTabLain); mq.removeEventListener('change', selaraskan); };
  }, []);
  return null;
}

const langganan = (ubah: () => void) => {
  window.addEventListener('wm-tema', ubah);
  return () => window.removeEventListener('wm-tema', ubah);
};

/** Mode gelap (dipakai di HP). */
export function useTema(): [boolean, () => void] {
  const gelap = useSyncExternalStore(langganan, sedangGelap, () => false);
  const tukar = () => {
    const baru = !sedangGelap();
    terapkan(baru);
    try { localStorage.setItem(KUNCI_TEMA, baru ? 'gelap' : 'terang'); } catch {}
  };
  return [gelap, tukar];
}

const langgananGaya = (ubah: () => void) => {
  window.addEventListener('wm-gaya', ubah);
  return () => window.removeEventListener('wm-gaya', ubah);
};

/** Gaya Glass / Matte (dipakai di sidebar desktop). Mengembalikan [matte, tukar]. */
export function useGaya(): [boolean, () => void] {
  const matte = useSyncExternalStore(langgananGaya, sedangMatte, () => false);
  const tukar = () => {
    const baru = !sedangMatte();
    try { localStorage.setItem(KUNCI_GAYA, baru ? 'matte' : 'glass'); } catch {}
    terapkanGaya(baru || layarHp());
  };
  return [matte, tukar];
}

export function IkonTema({ gelap, className = 'w-4 h-4' }: { gelap: boolean; className?: string }) {
  return gelap ? (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
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
