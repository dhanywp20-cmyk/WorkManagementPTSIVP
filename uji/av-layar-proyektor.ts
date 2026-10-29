/**
 * uji/av-layar-proyektor.ts - rumus lanjutan Kalkulator AV: ketajaman resolusi, geometri pandang,
 * videowall, proyektor. Angka pembanding dihitung manual.
 *
 * Jalankan: npx tsx uji/av-layar-proyektor.ts
 */
import { readFileSync } from 'fs';
import { ukuranDariDiagonal } from '../lib/av-hitung';
import { cekResolusi, hitungBlending, jarakPikselMenyatuM, jarakTerdekatNyamanM, lumenSpesifikasi, lumenUntukKontras, PANEL_VIDEOWALL, rencanaBlending, rentangJarakLempar, rentangTinggiLensa, rumusLensaDariDuaTitik, saranSusunanBlending, sudutKeAtasDerajat, teksRasio, videowallUntuk } from '../lib/av-layar-proyektor';

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
//  Rumus lensa dengan koreksi b (Panasonic ET-D3QW200, 100" 17:9 lebar 2,245 m): 1,189 - 1,418 m.
const ljB = rentangJarakLempar(2.245, 0.566, 0.669, 0.082);
if (Math.abs(ljB.dekatM - 1.189) > 0.005 || Math.abs(ljB.jauhM - 1.418) > 0.006) { console.log(`  GAGAL koreksi jarak b Panasonic: ${ljB.dekatM} - ${ljB.jauhM}`); process.exitCode = 1; }
else console.log('  ok   koreksi jarak b: L = TR x lebar - b sama dengan kalkulator Panasonic (1,189 - 1,418 m)');
cek('gambar 3 m, throw 1,2-1,9 -> 3,6-5,7 m (urutan masukan bebas)', dekat(lj.dekatM, 3.6) && dekat(lj.jauhM, 5.7));
const lens = rentangTinggiLensa(1, 1.5, 50, 10);
cek('pusat gambar 1,75 m, shift +50%/-10% -> lensa 1,60-2,50 m', dekat(lens.terendahM, 1.6) && dekat(lens.tertinggiM, 2.5));
const bl = hitungBlending(3, 1, 4, 15, 1920, 1200);
cek('blending 3 × 1, 4 m, overlap 15% -> 10,8 m, 5184 px', dekat(bl.lebarM, 10.8) && bl.resX === 5184 && dekat(bl.tinggiM, 2.5) && bl.resY === 1200);

console.log('\nRencana blending immersive');
const WUXGA = { resX: 1920, resY: 1200 };
const rp = rencanaBlending({ ...WUXGA, kolom: 3, baris: 1, overlapH: 15, overlapV: 15, mode: 'proyektor', lebarSatuM: 4 });
cek('mode proyektor sama dengan hitungBlending (3 × 1, 4 m)', rp.kanvasX === 5184 && rp.kanvasY === 1200 && dekat(rp.lebarM, 10.8) && dekat(rp.tinggiM, 2.5));
cek('1 baris: overlap atas-bawah 0 px walau diisi 15%', rp.overlapVpx === 0 && rp.zonaAtasBawah === 0 && rp.zonaKiriKanan === 2);
cek('peta piksel: P2 mulai di x = 1920 - 288 = 1632, P3 berakhir di tepi kanvas', rp.peta[1].x === 1632 && rp.peta[2].x2 === rp.kanvasX);
cek('mode proyektor: konten = kanvas, tanpa mask', rp.kontenX === rp.kanvasX && rp.kontenY === rp.kanvasY && rp.maskX === 0);
cek('pitch 4 m / 1920 px = 2,08 mm', dekat(rp.pitchMm, 2.083));
const rg = rencanaBlending({ ...WUXGA, kolom: 4, baris: 2, overlapH: 20, overlapV: 15, mode: 'proyektor', lebarSatuM: 3 });
cek('4 × 2: kanvas 4·1920 − 3·384 = 6528, 2·1200 − 180 = 2220', rg.kanvasX === 6528 && rg.kanvasY === 2220);
cek('4 × 2: zona 6 kiri-kanan, 4 atas-bawah, 3 sudut', rg.zonaKiriKanan === 6 && rg.zonaAtasBawah === 4 && rg.zonaSudut === 3);
cek('4 × 2: P6 = kolom 2 baris 2 di (1536, 1020)', rg.peta[5].kolom === 2 && rg.peta[5].baris === 2 && rg.peta[5].x === 1536 && rg.peta[5].y === 1020);
//  Target lebar 12 × tinggi 3 m dengan 3 × 1: tinggi yang membatasi (5184 px menutup lebar dengan 12/5184 m/px,
//  tetapi 1200 px tinggi butuh 3/1200 = 2,5 mm/px) -> gambar per proyektor 4,8 m, lebar konten 4800 px, mask 384 px.
const rt = rencanaBlending({ ...WUXGA, kolom: 3, baris: 1, overlapH: 15, overlapV: 15, mode: 'target', targetLebarM: 12, targetTinggiM: 3 });
cek('target 12 × 3 m, 3 × 1: menutup kedua arah', rt.lebarM >= 12 - 1e-9 && rt.tinggiM >= 3 - 1e-9);
cek('target 12 × 3 m, 3 × 1: per proyektor 4,8 × 3 m', dekat(rt.lebarSatuM, 4.8) && dekat(rt.tinggiSatuM, 3));
cek('target 12 × 3 m, 3 × 1: konten 4800 × 1200, mask 384 × 0', rt.kontenX === 4800 && rt.kontenY === 1200 && rt.maskX === 384 && rt.maskY === 0);
cek('efisiensi = konten / semua piksel native (4800·1200 / 3·1920·1200 = 83,3%)', dekat(rt.efisiensiPersen, 83.33));
cek('jarak lempar = TR × lebar per proyektor', dekat(rencanaBlending({ ...WUXGA, kolom: 1, baris: 1, overlapH: 0, overlapV: 0, mode: 'proyektor', lebarSatuM: 3, throwRatio: 1.5 }).jarakLemparM, 4.5));
const sr = saranSusunanBlending({ ...WUXGA, overlapH: 15, overlapV: 15, targetLebarM: 12, targetTinggiM: 3 });
cek('saran: jumlah proyektor naik & resolusi konten selalu naik', sr.length >= 2 && sr.every((s, i) => i === 0 || (s.jumlah >= sr[i - 1].jumlah && s.kontenX * s.kontenY > sr[i - 1].kontenX * sr[i - 1].kontenY)));
cek('saran: 4 × 1 dilewati (tertahan tinggi target, tidak lebih baik dari 3 × 1)', !sr.some(s => s.kolom === 4 && s.baris === 1));
cek('saran: semua menutup target', sr.every(s => s.lebarM >= 12 - 1e-9 && s.tinggiM >= 3 - 1e-9));
cek('rasio 3552 : 1200 = 2,96 : 1', teksRasio(3552, 1200) === '2,96 : 1');

console.log('\nKalkulator Proyektor vs kalkulator Panasonic (PT-RQ50K + ET-D3QW200, 17:9)');
const d100 = ukuranDariDiagonal(100, 17, 9), d200 = ukuranDariDiagonal(200, 17, 9);
cek('100" 17:9 -> lebar 2,245 m (Screen size Panasonic)', dekat(d100.lebarM, 2.245, 0.002));
const rl = rumusLensaDariDuaTitik(d100.lebarM, 1.189, d200.lebarM, 2.460);
cek('dua hasil Panasonic (100" 1,189 m & 200" 2,460 m) -> L = 0,566 x SW - 0,082', !!rl && dekat(rl.tr, 0.566, 0.002) && dekat(rl.b, 0.082, 0.003));
const jr = rentangJarakLempar(d100.lebarM, 0.566, 0.669, 0.082);
cek('100": jarak 1,189 - 1,418 m (selisih < 5 mm)', dekat(jr.dekatM, 1.189, 0.005) && dekat(jr.jauhM, 1.418, 0.005));
cek('lebar sama / jarak kosong -> null', rumusLensaDariDuaTitik(2, 1, 2, 1.5) === null && rumusLensaDariDuaTitik(2, 0, 4, 2) === null);
const ui = readFileSync('app/(portal)/tools-team/_components/av/KalkulatorProyektor.tsx', 'utf8');
cek('Kalkulator punya rasio 17:9 & input diagonal', /'17:9'/.test(ui) && /label="Diagonal gambar"/.test(ui));
cek('koreksi b kosong (wide & tele) -> peringatan di masukan & hasil', /\{!koreksi && !koreksiTele && \(/.test(ui) && /nada=\{koreksi \|\| koreksiTele \? undefined : 'awas'\}/.test(ui));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
