'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

export type Tampilan = 'kaca' | 'terang' | 'gelap';

export const KUNCI_TEMA = 'wm-tema';
const KELAS_GELAP = 'gelap';
const KELAS_KACA = 'pts-kaca';
const KELAS_LC = 'rute-lc';

export const POLA_RUTE_LC = /^\/(learning-center|kelas)(\/|$)/;
export const POLA_RUTE_BAGIKAN = /\/share(\/|$)/;

export const URUTAN_TAMPILAN: Tampilan[] = ['kaca', 'terang', 'gelap'];
export const LABEL_TAMPILAN: Record<Tampilan, string> = { kaca: 'PTS Kaca', terang: 'Terang', gelap: 'Gelap' };

export function rapikanTampilan(v: string | null | undefined): Tampilan {
  return v === 'terang' || v === 'gelap' ? v : 'kaca';
}

export function kelasTampilan(t: Tampilan, jalur: string): { kaca: boolean; gelap: boolean; lc: boolean } {
  const lc = POLA_RUTE_LC.test(jalur);
  const bagikan = POLA_RUTE_BAGIKAN.test(jalur);
  if (t === 'kaca' && !bagikan) return { kaca: true, gelap: !lc, lc };
  return { kaca: false, gelap: t === 'gelap', lc: false };
}

export const SKRIP_TEMA_AWAL = [
  `try{var v=localStorage.getItem('${KUNCI_TEMA}'),t=v==='terang'||v==='gelap'?v:'kaca',p=location.pathname,`,
  `lc=${POLA_RUTE_LC}.test(p),sh=${POLA_RUTE_BAGIKAN}.test(p),c=document.documentElement.classList;`,
  `if(t==='kaca'&&!sh){c.add('${KELAS_KACA}');if(lc)c.add('${KELAS_LC}');else c.add('${KELAS_GELAP}')}`,
  `else if(t==='gelap')c.add('${KELAS_GELAP}')}catch(e){}`,
].join('');

function bacaSimpanan(): Tampilan {
  try { return rapikanTampilan(localStorage.getItem(KUNCI_TEMA)); } catch { return 'kaca'; }
}

let tampilanKini: Tampilan | null = null;
const tampilanSekarang = (): Tampilan => {
  if (typeof window === 'undefined') return 'kaca';
  if (tampilanKini === null) tampilanKini = bacaSimpanan();
  return tampilanKini;
};

function pasangKelas(t: Tampilan, jalur: string) {
  const akar = document.documentElement;
  const k = kelasTampilan(t, jalur);
  akar.classList.toggle(KELAS_KACA, k.kaca);
  akar.classList.toggle(KELAS_GELAP, k.gelap);
  akar.classList.toggle(KELAS_LC, k.lc);
  akar.style.colorScheme = k.gelap ? 'dark' : '';
}

function terapkan(t: Tampilan) {
  tampilanKini = t;
  pasangKelas(t, window.location.pathname);
  window.dispatchEvent(new CustomEvent('wm-tema', { detail: t }));
}

export function pilihTampilan(t: Tampilan) {
  try {
    if (t === 'kaca') localStorage.removeItem(KUNCI_TEMA);
    else localStorage.setItem(KUNCI_TEMA, t);
  } catch {}
  terapkan(t);
}

export function kembaliBawaan() {
  try { localStorage.removeItem(KUNCI_TEMA); } catch {}
  if (typeof document !== 'undefined') terapkan('kaca');
}

export function PenyelarasTema() {
  const jalur = usePathname() ?? '';
  useEffect(() => { pasangKelas(tampilanSekarang(), jalur); }, [jalur]);
  useEffect(() => {
    const dariTabLain = (e: StorageEvent) => { if (e.key === KUNCI_TEMA) terapkan(rapikanTampilan(e.newValue)); };
    window.addEventListener('storage', dariTabLain);
    return () => window.removeEventListener('storage', dariTabLain);
  }, []);
  return null;
}

const langganan = (ubah: () => void) => {
  window.addEventListener('wm-tema', ubah);
  return () => window.removeEventListener('wm-tema', ubah);
};

export function useTampilan(): [Tampilan, (t: Tampilan) => void] {
  const t = useSyncExternalStore(langganan, tampilanSekarang, () => 'kaca' as Tampilan);
  return [t, pilihTampilan];
}

export function useTema(): [Tampilan, () => void, Tampilan] {
  const [t, pilih] = useTampilan();
  const berikut = URUTAN_TAMPILAN[(URUTAN_TAMPILAN.indexOf(t) + 1) % URUTAN_TAMPILAN.length];
  return [t, () => pilih(berikut), berikut];
}

export function IkonTema({ tampilan, className = 'w-4 h-4' }: { tampilan: Tampilan; className?: string }) {
  if (tampilan === 'terang') return (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
  if (tampilan === 'gelap') return (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
  return (
    <svg aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="13" height="13" rx="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3.5h9.5A3 3 0 0120.5 6.5V16" />
    </svg>
  );
}
