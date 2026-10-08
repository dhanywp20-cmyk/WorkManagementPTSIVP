/**
 * uji/av-layar-proyektor.ts - rumus lanjutan Kalkulator AV: ketajaman resolusi, geometri pandang,
 * videowall, proyektor. Angka pembanding dihitung manual.
 *
 * Jalankan: npx tsx uji/av-layar-proyektor.ts
 */
import { cekResolusi, hitungBlending, jarakPikselMenyatuM, jarakTerdekatNyamanM, lumenSpesifikasi, lumenUntukKontras, PANEL_VIDEOWALL, rentangJarakLempar, rentangTinggiLensa, sudutKeAtasDerajat, videowallUntuk } from '../lib/av-layar-proyektor';

let lulus = 0, gagal = 0;
const dekat = (a: number, b: number, t = 0.01) => Math.abs(a - b) <= t;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nKetajaman & geometri');
cek('pitch 1 mm menyatu di ±3,44 m (1 menit busur)', dekat(jarakPikselMenyatuM(1), 3.4377));
const r = cekResolusi(1.9, 3);
cek('layar 1,9 m, penonton 3 m: Full HD belum cukup (3,40 m), 4K cukup (1,70 m)', !r[0].cukup && dekat(r[0].menyatuM, 3.402, 0.02) && r[1].cukup && dekat(r[1].menyatuM, 1.701, 0.02));
cek('tepi atas 1 m di atas mata -> jarak nyaman 30° = 1,73 m', dekat(jarakTerdekatNyamanM(1.2, 1.0, 1.2, 30), 1.732));
cek('sudut di jarak itu = 30°', dekat(sudutKeAtasDerajat(1.7321, 1.2, 1.0, 1.2), 30, 0.05));
cek('tepi atas di bawah mata -> jarak 0', jarakTerdekatNyamanM(1.6, 0.5, 0.8) === 0);

console.log('\nVideowall');
const vw = videowallUntuk(2.44, 1.37, PANEL_VIDEOWALL[2]);
cek('target 2,44 × 1,37 m dengan 55" bezel 3,5 mm -> 2 × 2', vw.kolom === 2 && vw.baris === 2 && vw.jumlah === 4);
cek('ukuran nyata 2×2 55" ±2,44 m lebar, resolusi 3840×2160', dekat(vw.lebarM, 2.4387, 0.005) && vw.resX === 3840 && vw.resY === 2160);

console.log('\nProyektor');
cek('kontras 15:1, 300 lux, 4 m² -> 16.800 lumen', dekat(lumenUntukKontras(4, 300, 15, 1), 16800));
cek('gain 1,3 menurunkan kebutuhan', dekat(lumenUntukKontras(4, 300, 15, 1.3), 16800 / 1.3));
cek('susut 20% -> spesifikasi 21.000 lumen', dekat(lumenSpesifikasi(16800, 20), 21000));
const lj = rentangJarakLempar(3, 1.9, 1.2);
cek('gambar 3 m, throw 1,2-1,9 -> 3,6-5,7 m (urutan masukan bebas)', dekat(lj.dekatM, 3.6) && dekat(lj.jauhM, 5.7));
const lens = rentangTinggiLensa(1, 1.5, 50, 10);
cek('pusat gambar 1,75 m, shift +50%/-10% -> lensa 1,60-2,50 m', dekat(lens.terendahM, 1.6) && dekat(lens.tertinggiM, 2.5));
const bl = hitungBlending(3, 1, 4, 15, 1920, 1200);
cek('blending 3 × 1, 4 m, overlap 15% -> 10,8 m, 5184 px', dekat(bl.lebarM, 10.8) && bl.resX === 5184 && dekat(bl.tinggiM, 2.5) && bl.resY === 1200);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
