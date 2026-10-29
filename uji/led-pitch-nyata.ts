/**
 * uji/led-pitch-nyata.ts - piksel cabinet dari pitch NYATA, bukan nama dagang.
 *
 * Nama dagang LED memotong pitch sebenarnya (P2.9 = 2,976 mm). Dulu piksel dihitung dari nama dagangnya:
 * cabinet 500 mm P2.9 = 172 px (seharusnya 168), P1.9 = 263 px (seharusnya 256) - resolusi, port LAN & sending
 * card ikut meleset. Angka acuan = datasheet cabinet umum (Absen, Unilumin, Novastar loading table).
 *
 * Jalankan: npx tsx uji/led-pitch-nyata.ts
 */
import { hitungLED, pikselUnit, pitchNyata } from '../lib/av-hitung';
import { susunanLED } from '../app/(portal)/tools-team/_components/desain3d/inti/produk';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}

console.log('\nPiksel per sisi cabinet (datasheet)');
const ACUAN: [number, number, number][] = [
  //  [ukuran mm, pitch (nama dagang), piksel datasheet]
  [500, 2.9, 168], [1000, 2.9, 336], [500, 1.9, 256], [500, 2.6, 192], [1000, 2.6, 384], [500, 3.91, 128], [1000, 3.91, 256],
  [500, 4.81, 104], [500, 1.5, 320], [600, 1.5, 384], [337.5, 1.5, 216], [500, 1.2, 400], [600, 1.2, 480], [337.5, 1.2, 270],
  [600, 0.9, 640], [337.5, 0.9, 360], [600, 1.87, 320], [337.5, 1.87, 180], [960, 6.67, 144], [500, 2.5, 200], [640, 2.5, 256],
  [320, 1.86, 172], [960, 5, 192], [960, 10, 96],
];
for (const [mm, p, px] of ACUAN) {
  const kita = pikselUnit(mm, p);
  cek(`${mm} mm P${p} = ${px} px`, kita === px, `kita ${kita}`);
}
cek('pitch yang bukan nama dagang tidak diubah (2,5 / 1,86 / 10)', pitchNyata(2.5) === 2.5 && pitchNyata(1.86) === 1.86 && pitchNyata(10) === 10);

console.log('\nResolusi layar ikut benar');
//  4 × 2,5 m dari cabinet 500 × 500 P2.9: 8 × 5 cabinet = 1344 × 840 (dulu 1376 × 860).
const h = hitungLED({ pitch: 2.9, cabLebar: 500, cabTinggi: 500, kolom: 8, baris: 5, dayaMaksCab: 150, faktorRata: 0.33, beratCab: 7.5, refresh: 60, bit: 8, tegangan: 220 });
cek('Kalkulator LED: 8 × 5 cabinet P2.9 = 1344 × 840', h.resX === 1344 && h.resY === 840, `${h.resX} × ${h.resY}`);
const s3 = susunanLED({ w: 4, h: 2.5, pitch: 2.9, cabW: 500, cabH: 500 });
cek('Desain 3D: LED 4 × 2,5 m P2.9 = 1344 × 840 (sama dengan Kalkulator LED)', s3.resX === 1344 && s3.resY === 840, `${s3.resX} × ${s3.resY}`);
cek('piksel dari datasheet tetap menang (pxUnitX 170)', susunanLED({ w: 4, h: 2.5, pitch: 2.9, cabW: 500, cabH: 500, pxUnitX: 170, pxUnitY: 170 }).resX === 1360);

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
