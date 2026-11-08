'use client';
import { useEffect, useSyncExternalStore } from 'react';

export const KUNCI_TEMA = 'wm-tema';
const KELAS = 'gelap';

export const SKRIP_TEMA_AWAL = `try{if(localStorage.getItem('${KUNCI_TEMA}')==='gelap')document.documentElement.classList.add('${KELAS}')}catch(e){}`;

const sedangGelap = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KELAS);

function terapkan(gelap: boolean) {
  document.documentElement.classList.toggle(KELAS, gelap);
  document.documentElement.style.colorScheme = gelap ? 'dark' : '';
  window.dispatchEvent(new CustomEvent('wm-tema', { detail: gelap }));
}

export function PenyelarasTema() {
  useEffect(() => {
    if (sedangGelap()) document.documentElement.style.colorScheme = 'dark';
    const dariTabLain = (e: StorageEvent) => { if (e.key === KUNCI_TEMA) terapkan(e.newValue === 'gelap'); };
    window.addEventListener('storage', dariTabLain);
    return () => window.removeEventListener('storage', dariTabLain);
  }, []);
  return null;
}

const langganan = (ubah: () => void) => {
  window.addEventListener('wm-tema', ubah);
  return () => window.removeEventListener('wm-tema', ubah);
};

export function useTema(): [boolean, () => void] {
  const gelap = useSyncExternalStore(langganan, sedangGelap, () => false);
  const tukar = () => {
    const baru = !sedangGelap();
    terapkan(baru);
    try { localStorage.setItem(KUNCI_TEMA, baru ? 'gelap' : 'terang'); } catch {}
  };
  return [gelap, tukar];
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
