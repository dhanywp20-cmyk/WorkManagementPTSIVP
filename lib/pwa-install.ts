'use client';

let promptEvent: any = null;
let statusTerpasang = false;
const pendengar = new Set<() => void>();

export function diAplikasiAndroid(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('WorkManagementAndroid');
}

function cekTerpasang(): boolean {
  if (typeof window === 'undefined') return false;
  if (diAplikasiAndroid()) return true;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
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

export function statusInstalasiPWA(): StatusInstallPWA {
  if (statusTerpasang) return 'terpasang';
  if (promptEvent) return 'siap';
  if (isIOSSafari()) return 'ios';
  return 'belum-siap';
}

export function subscribeInstallPWA(fn: () => void): () => void {
  pendengar.add(fn);
  return () => pendengar.delete(fn);
}

export async function pasangAplikasiPWA(): Promise<boolean> {
  if (!promptEvent) return false;
  promptEvent.prompt();
  const hasil = await promptEvent.userChoice.catch(() => null);
  promptEvent = null;
  pendengar.forEach(fn => fn());
  return hasil?.outcome === 'accepted';
}
