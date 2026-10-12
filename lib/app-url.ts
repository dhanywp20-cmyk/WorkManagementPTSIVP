/**
 * lib/app-url.ts - URL platform ini, dipakai di tautan pesan WA/notifikasi dan link berbagi.
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
 * Client (browser): window.location.origin - otomatis mengikuti domain yang
 * SEDANG diakses, termasuk custom domain milik pembeli lain - KECUALI domain
 * Preview Vercel (lihat adalahPreviewVercel).
 *
 * Server (mis. cron job - tidak ada window): NEXT_PUBLIC_APP_URL kalau
 * di-set, atau domain lama sebagai fallback terakhir supaya tautan tidak
 * tiba-tiba mati kalau env var belum dikonfigurasi.
 */
const DOMAIN_CADANGAN = 'https://work-management-ptsivp.vercel.app';

/**
 * Domain Preview / deployment Vercel (`proyek-git-cabang-tim.vercel.app`,
 * `proyek-abc123xyz-tim.vercel.app`) dikunci "Vercel Authentication": hanya
 * pemilik akun Vercel yang bisa membukanya. Tautan yang dibuat saat menguji di
 * Preview - link checklist untuk tim, link WA - dulu ikut membawa domain itu,
 * dan penerimanya terlempar ke halaman login Vercel ("link jadi private").
 * Domain produksi (`proyek.vercel.app` atau custom domain) tidak cocok pola ini.
 */
export function adalahPreviewVercel(host: string): boolean {
  if (!/\.vercel\.app$/i.test(host)) return false;
  return /-git-/i.test(host) || /-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/i.test(host);
}

export function appBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    //  Dibuka dari Preview: tautan untuk orang lain tetap harus ke domain produksi.
    if (adalahPreviewVercel(window.location.hostname)) return env || DOMAIN_CADANGAN;
    return window.location.origin;
  }
  return env || DOMAIN_CADANGAN;
}

/** Tautan lengkap ke path tertentu di platform ini (bawaan: /dashboard). */
export function appLink(path: string = '/dashboard'): string {
  return `${appBaseUrl()}${path}`;
}
