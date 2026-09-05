/**
 * lib/app-url.ts - URL platform ini, dipakai di tautan pesan WA/notifikasi.
 *
 * Sebelumnya domain ditulis literal di ~47 tempat tersebar di banyak
 * modul (dan dua domain BERBEDA sekaligus - team-ticketing.vercel.app di
 * Ticketing, work-management-ptsivp.vercel.app di modul lain, sisa dari
 * riwayat sebelum modul-modul itu digabung jadi satu platform). Karena
 * platform ini dijual ke perusahaan lain yang masing-masing punya domainnya
 * sendiri, domain yang di-hardcode di kode akan SELALU salah untuk pembeli
 * lain - link di pesan WA mereka akan mengarah ke domain vendor, bukan
 * domain mereka sendiri.
 *
 * Client (browser): window.location.origin - selalu benar, otomatis
 * mengikuti domain yang SEDANG diakses, termasuk custom domain milik
 * pembeli lain, tanpa perlu konfigurasi apa pun.
 *
 * Server (mis. cron job - tidak ada window): NEXT_PUBLIC_APP_URL kalau
 * di-set, atau domain lama sebagai fallback terakhir supaya tautan tidak
 * tiba-tiba mati kalau env var belum dikonfigurasi.
 */
export function appBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || 'https://work-management-ptsivp.vercel.app';
}

/** Tautan lengkap ke path tertentu di platform ini (bawaan: /dashboard). */
export function appLink(path: string = '/dashboard'): string {
  return `${appBaseUrl()}${path}`;
}
