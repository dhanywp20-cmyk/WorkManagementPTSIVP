'use client';

/**
 * Status & aksi install PWA, dipusatkan di satu tempat - sebelumnya event
 * `beforeinstallprompt` (Chrome/Android) hanya ditangkap sendiri oleh
 * PwaBootstrap (banner otomatis), jadi tidak ada cara bagi tempat lain
 * (mis. tombol di Profil) untuk memicu prompt install yang sama.
 *
 * Event ini hanya ditembakkan browser SEKALI per kunjungan/tab, jadi harus
 * ditangkap di level modul (bukan di dalam komponen yang bisa mount lebih
 * dari sekali) supaya siapa pun yang butuh bisa memakai prompt yang sama.
 */

let promptEvent: any = null;
let statusTerpasang = false;
const pendengar = new Set<() => void>();

function cekTerpasang(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari lama belum punya display-mode media query - pakai properti khususnya.
  return !!(window.navigator as any).standalone;
}

export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && safari;
}

if (typeof window !== 'undefined') {
  statusTerpasang = cekTerpasang();
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    promptEvent = e;
    pendengar.forEach(fn => fn());
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    statusTerpasang = true;
    pendengar.forEach(fn => fn());
  });
}

export type StatusInstallPWA = 'terpasang' | 'siap' | 'ios' | 'belum-siap';

/**
 * 'terpasang'  - sudah berjalan sebagai app terpasang, tidak perlu tawaran apa pun.
 * 'siap'       - Chrome/Android sudah menyiapkan prompt asli, tinggal dipicu.
 * 'ios'        - Safari iOS tidak punya prompt otomatis, perlu langkah manual.
 * 'belum-siap' - browser lain / prompt belum ditembak - arahkan ke panduan manual.
 */
export function statusInstalasiPWA(): StatusInstallPWA {
  if (statusTerpasang) return 'terpasang';
  if (promptEvent) return 'siap';
  if (isIOSSafari()) return 'ios';
  return 'belum-siap';
}

/** Dipanggil komponen yang perlu ikut re-render begitu status di atas berubah. */
export function subscribeInstallPWA(fn: () => void): () => void {
  pendengar.add(fn);
  return () => pendengar.delete(fn);
}

/** Memicu prompt install asli. Mengembalikan false kalau memang belum tersedia (bukan galat). */
export async function pasangAplikasiPWA(): Promise<boolean> {
  if (!promptEvent) return false;
  promptEvent.prompt();
  const hasil = await promptEvent.userChoice.catch(() => null);
  promptEvent = null;
  pendengar.forEach(fn => fn());
  return hasil?.outcome === 'accepted';
}
