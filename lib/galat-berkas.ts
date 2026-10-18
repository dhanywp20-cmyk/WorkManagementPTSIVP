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

/** Kunci sessionStorage: waktu (ms) muat ulang otomatis terakhir di tab ini. */
export const KUNCI_MUAT_ULANG = 'galat-berkas-muat-ulang';

/** Jarak minimum antar muat ulang otomatis - cukup untuk mencegah putaran tanpa henti. */
export const JEDA_MUAT_ULANG_MS = 60_000;

/**
 * Bolehkah memuat ulang otomatis sekarang? Dulu penandanya '1' dan tidak pernah dihapus: tab yang dibuka
 * seharian hanya sembuh sendiri di deploy PERTAMA - deploy berikutnya meninggalkan layar galat / menu
 * macet. Sekarang yang disimpan waktunya: boleh lagi bila muat ulang terakhir sudah lewat 1 menit
 * (berkas yang tetap gagal sesudah dimuat ulang tidak membuat tab memuat ulang tanpa henti).
 */
export function bolehMuatUlang(terakhir: string | null, kini: number): boolean {
  const t = Number(terakhir);
  return !terakhir || !Number.isFinite(t) || kini - t > JEDA_MUAT_ULANG_MS;
}
