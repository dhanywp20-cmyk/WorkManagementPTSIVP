/**
 * uji/desain3d-grid-proyektor.ts - grid cahaya proyektor (inti/gridProyektor.ts): jumlah kotak mengikuti
 * rasio gambar, ukuran satu kotak dalam mm, pilihan kolom yang sah.
 *
 * Jalankan: npm test -- desain3d-grid-proyektor
 */
import { gridKolomSah, KOLOM_GRID_AWAL, kotakGrid, labelKotakGrid } from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const g169 = kotakGrid(3.92, 2.205, undefined);
cek('bawaan 16 kolom; gambar 16:9 -> 16 × 9', g169.kolom === KOLOM_GRID_AWAL && g169.baris === 9);
cek('gambar 3,92 m -> 1 kotak 245 × 245 mm', labelKotakGrid(g169) === '1 kotak 245 × 245 mm');
const g43 = kotakGrid(2.4, 1.8, 16);
cek('gambar 4:3 -> 16 × 12, kotak persegi', g43.baris === 12 && Math.abs(g43.w - g43.h) < 1e-9);
const g8 = kotakGrid(6, 3.375, 8);
cek('8 kolom di 6 m -> 750 mm per kotak', g8.kolom === 8 && labelKotakGrid(g8).startsWith('1 kotak 750 × '));
cek('pemisah ribuan untuk kotak besar', labelKotakGrid(kotakGrid(16, 10, 8)) === '1 kotak 2.000 × 2.000 mm');
cek('kolom tidak sah -> bawaan', gridKolomSah(7) === KOLOM_GRID_AWAL && gridKolomSah('16') === KOLOM_GRID_AWAL && gridKolomSah(24) === 24);
cek('gambar sangat pipih tetap minimal 1 baris', kotakGrid(10, 0.01, 16).baris === 1);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
