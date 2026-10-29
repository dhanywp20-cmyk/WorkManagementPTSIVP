/**
 * Kategori bawaan proyek insentif - modul DAUN, sengaja tanpa impor apa pun.
 *
 * Dulu tinggal di incentive-scheme-kategori, dan incentive-scheme-aturan membacanya saat dimuat
 * (SKEMA_BAWAAN). Karena -kategori mengimpor -simpan yang mengimpor -aturan, memuat -kategori lebih dulu
 * membuat -aturan berjalan sebelum konstanta ini ada: "Cannot access 'l' before initialization" di
 * Ticketing saat update status. Di modul tanpa impor, urutan muat apa pun selalu aman
 * (uji/urutan-muat-insentif.ts).
 */
export const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;
