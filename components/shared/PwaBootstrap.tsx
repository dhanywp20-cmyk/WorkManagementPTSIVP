'use client';
import { useEffect } from 'react';
import { daftarSW } from '@/lib/push-client';

/**
 * Dipasang sekali di root layout: daftarkan service worker (syarat installability PWA + push
 * notification) seawal mungkin, tidak menunggu pengguna membuka dashboard dulu.
 *
 * Banner otomatis "Pasang aplikasi ini di HP" DIHAPUS atas permintaan owner (2026-10-09): muncul
 * terus dan mengganggu tampilan. Memasang aplikasi tetap bisa lewat Profil › Install aplikasi
 * (InstallGuideModal, lib/pwa-install.ts) - tanpa menyela orang yang sedang bekerja.
 */
export function PwaBootstrap() {
  useEffect(() => { void daftarSW(); }, []);
  return null;
}
