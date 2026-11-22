'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

export const KUNCI_TEMA = 'wm-tema';
const KELAS = 'gelap';
const KELAS_AURORA = 'aurora';
const KUNCI_SESI = 'ivp_user';

// Rute di luar portal yang tampilannya tidak ikut tema Aurora (perilaku lama).
const POLA_PUBLIK = '^/(kelas|checklist|project-progress/share)(/|$)';
// Learning Center: isi modul tidak ikut remap gelap bawaan (tetap seperti semula).
const POLA_LC = '^/learning-center(/|$)';

/*
 * Aturan tema:
 * - Portal + sudah login + preferensi bukan 'terang'  -> html.aurora (shell kaca gelap) + html.gelap (remap isi).
 *   Di Learning Center, html.gelap hanya bila pengguna memilih gelap secara eksplisit (sama seperti dulu).
 * - Portal belum login (layar masuk)                  -> tanpa kelas: latar IVP tetap tampil.
 * - Rute publik                                       -> html.gelap hanya bila dipilih eksplisit (perilaku lama).
 */
export const SKRIP_TEMA_AWAL = `try{var d=document.documentElement,k=localStorage.getItem('${KUNCI_TEMA}'),p=location.pathname,m=!!sessionStorage.getItem('${KUNCI_SESI}');if(new RegExp('${POLA_PUBLIK}').test(p)){if(k==='gelap')d.classList.add('${KELAS}')}else if(m&&k!=='terang'){d.classList.add('${KELAS_AURORA}');var l=new RegExp('${POLA_LC}').test(p);if(l)d.setAttribute('data-lc','');if(k==='gelap'||!l)d.classList.add('${KELAS}');d.style.colorScheme='dark'}}catch(e){}`;

// null = belum diketahui kerangka portal -> pakai jejak sesi (sama seperti skrip awal).
let sudahMasuk: boolean | null = null;
let ruteSekarang = '';

function bacaPilihan(): string | null {
  try { return localStorage.getItem(KUNCI_TEMA); } catch { return null; }
}

function adaSesi(): boolean {
  try { return !!sessionStorage.getItem(KUNCI_SESI); } catch { return false; }
}

const sedangGelap = () => typeof document !== 'undefined'
  && (document.documentElement.classList.contains(KELAS) || document.documentElement.classList.contains(KELAS_AURORA));

function terapkanTema() {
  if (typeof document === 'undefined') return;
  const d = document.documentElement;
  const k = bacaPilihan();
  const rute = ruteSekarang || location.pathname;
  let aurora = false;
  let gelap = false;
  if (new RegExp(POLA_PUBLIK).test(rute)) {
    gelap = k === 'gelap';
  } else if ((sudahMasuk ?? adaSesi()) && k !== 'terang') {
    aurora = true;
    gelap = k === 'gelap' || !new RegExp(POLA_LC).test(rute);
  }
  const berubah = d.classList.contains(KELAS) !== gelap || d.classList.contains(KELAS_AURORA) !== aurora;
  d.classList.toggle(KELAS, gelap);
  d.classList.toggle(KELAS_AURORA, aurora);
  // Penanda Learning Center: CSS Aurora tidak menyentuh isi modul ini.
  d.toggleAttribute('data-lc', aurora && new RegExp(POLA_LC).test(rute));
  d.style.colorScheme = gelap || aurora ? 'dark' : '';
  if (berubah) window.dispatchEvent(new CustomEvent('wm-tema', { detail: gelap || aurora }));
}

/** Dipanggil kerangka portal saat status login berubah. */
export function aturStatusMasukTema(masuk: boolean) {
  sudahMasuk = masuk;
  terapkanTema();
}

/** Layar masuk / logout: lepas tema Aurora supaya latar IVP tampil. Preferensi tetap disimpan. */
export function kembaliTerang() {
  aturStatusMasukTema(false);
}

export function PenyelarasTema() {
  const pathname = usePathname();
  useEffect(() => {
    ruteSekarang = pathname ?? '';
    terapkanTema();
  }, [pathname]);
  useEffect(() => {
    const dariTabLain = (e: StorageEvent) => { if (e.key === KUNCI_TEMA) terapkanTema(); };
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
    try { localStorage.setItem(KUNCI_TEMA, baru ? 'gelap' : 'terang'); } catch {}
    terapkanTema();
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
