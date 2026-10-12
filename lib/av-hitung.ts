/**
 * lib/av-hitung.ts - rumus Tools Team PTS (Audio Visual). Murni, tanpa
 * React / jaringan, supaya bisa diuji (uji/av-hitung.ts) dan dipakai ulang.
 * Dipecah per alat ke av-hitung-*.ts; berkas ini mengekspor ulang semuanya.
 *
 * Angka bawaan (daya/berat per m², kapasitas port controller) adalah NILAI
 * UMUM industri dan selalu bisa ditimpa di form. Untuk penawaran resmi,
 * gunakan datasheet produk yang ditawarkan.
 */
export * from './av-hitung-led';
export * from './av-hitung-ruang';
export * from './av-hitung-koneksi';
export * from './av-hitung-daya';
export * from './av-hitung-bom';
