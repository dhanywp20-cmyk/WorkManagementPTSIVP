/**
 * lib/versi-web.ts - aturan kapan halaman yang sudah lama terbuka perlu memeriksa versi web.
 *
 * Masalah yang ditangani: halaman yang dibiarkan terbuka (tab peramban berhari-hari, dan terutama WebView aplikasi
 * Android yang TIDAK PERNAH memuat ulang saat dibuka kembali dari latar belakang) terus menjalankan kode lama
 * setelah web diperbarui. Contoh nyata: perbaikan sesi 400 hari (22 Okt) tidak sampai ke aplikasi HP - kode lama di
 * memori masih memakai batas sesi 6 jam lalu "Keluar" sendiri.
 *
 * Aturannya hemat permintaan: tidak ada polling. Hanya satu permintaan ringan (/api/health, tanpa basis data) saat
 * halaman kembali dipakai setelah ditinggal cukup lama.
 */

/** Halaman tersembunyi minimal selama ini sebelum kembalinya memicu pemeriksaan versi. */
export const JEDA_PERIKSA_MS = 10 * 60 * 1000;

/** Perlu memeriksa versi saat halaman kembali terlihat? `tersembunyiSejak` null = belum pernah tersembunyi. */
export function perluPeriksa(tersembunyiSejak: number | null, sekarang: number, jeda = JEDA_PERIKSA_MS): boolean {
  return tersembunyiSejak !== null && sekarang - tersembunyiSejak >= jeda;
}

/**
 * Ada versi baru? Hanya bila KEDUA komit diketahui dan berbeda - di lokal / pratinjau tanpa komit tidak pernah
 * mengganggu dengan ajakan muat ulang.
 */
export function adaVersiBaru(komitHalaman: string | null | undefined, komitServer: string | null | undefined): boolean {
  const a = (komitHalaman ?? '').trim(), b = (komitServer ?? '').trim();
  return !!a && !!b && a !== b;
}
