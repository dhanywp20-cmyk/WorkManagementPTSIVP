/**
 * lib/galat-berkas.ts - mengenali galat "berkas aplikasi tidak termuat".
 *
 * Terjadi setelah deploy: tab yang masih terbuka meminta potongan JavaScript
 * (chunk) versi lama yang sudah tidak ada di server. Penyebabnya bukan bug di
 * halaman, dan muat ulang SEKALI selalu menyembuhkannya - jadi layar galat
 * memuat ulang sendiri alih-alih membiarkan pengguna menatap layar putih.
 *
 * Murni (tanpa React) supaya bisa diuji tanpa peramban.
 */

const POLA = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function galatBerkasTidakTermuat(e: { name?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return POLA.test(`${e.name ?? ''} ${e.message ?? ''}`);
}

/** Kunci sessionStorage: muat ulang otomatis hanya SEKALI per tab agar tidak berulang tanpa henti. */
export const KUNCI_MUAT_ULANG = 'galat-berkas-muat-ulang';
