/**
 * uji/proyektor-panasonic.ts - hitungan proyektor Desain 3D dibandingkan dengan kalkulator jarak lempar
 * Panasonic (https://docs.connect.panasonic.com/projector/calculator/tdc/, versi 2.79, mode Advance):
 * PT-RQ50K (51.000 lm pusat) + lensa ET-D3QW200, rasio 17:9 (Native 4K), gain 1,00, cahaya ruang 200 lux.
 *
 *   100" -> gambar 2,245 x 1,188 m, jarak 1,189-1,418 m, 19.117 lux, 6.085 cd/m², kontras 96:1
 *   200" -> lebar 4,490 m, jarak 2,460-2,919 m
 *
 * Dua titik itu memberi rumus lensa L = 0,566 x SW - 0,082 (min) & L = 0,669 x SW - 0,083 (maks): bukan
 * L = TR x SW murni, sehingga Desain 3D memakai TR terlebar/terpanjang + koreksi jarak b = 0,082 m.
 * Akurasi kalkulator pabrikan sendiri ±5%; di sini toleransi 0,5%.
 *
 * Jalankan: npx tsx uji/proyektor-panasonic.ts
 */
import {
  batasShift, bendaBaru, isiDariPustaka, jarakUntukLebar, keDunia, keGambar, kontrasProyektor, lebarGambarDi, lensaDari,
  lensaProyektor, luminanceDari, proyektorKeLayar, rasioGambarProyektor, sinarProyektor, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import type { EntriPustaka } from '../lib/pustaka';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
/** Selisih relatif <= tol (bawaan 0,5%). */
const mirip = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= Math.abs(b) * tol;

const ruang: Ruang = { p: 10, l: 10, t: 4, lantai: 'polos', r2: null };
const K = { x0: 0, p: 10, l: 10, t: 4 };
/** PT-RQ50K + ET-D3QW200 di meja (Desktop), lurus, tanpa lens shift. */
const rq50k: Benda = {
  ...bendaBaru('proyektor', K, { pasangProyektor: 'meja' }), nama: 'PT-RQ50K', lumen: 51000, rasioProyektor: '17:9',
  trMin: 0.566, trMax: 0.669, throwRatio: 0.566, koreksiJarak: 0.082, offsetLensa: 0, geserLensaH: 0, tilt: 0, rot: 180,
};
const W100 = 2.245, H100 = 1.188, W200 = 4.490;

console.log('\n1. Rasio 17:9 & ukuran gambar');
cek('rasio 17:9 (Native 4K): tinggi = lebar x 9/17', mirip(rasioGambarProyektor(rq50k), 9 / 17, 1e-9));
cek('100": lebar 2,245 m pada jarak terdekat 1,189 m (TR 0,566, b 0,082)', mirip(lebarGambarDi(rq50k, 1.189, 0.566), W100));
cek('100": tinggi gambar 1,188 m', mirip(lebarGambarDi(rq50k, 1.189, 0.566) * rasioGambarProyektor(rq50k), H100));

console.log('\n2. Jarak lempar (Distance to screen Min~Max)');
const [j1, j2] = jarakUntukLebar(rq50k, W100);
cek('100": 1,189 - 1,418 m', mirip(j1, 1.189) && mirip(j2, 1.418), `${j1.toFixed(3)} - ${j2.toFixed(3)}`);
const [k1, k2] = jarakUntukLebar(rq50k, W200);
cek('200": 2,460 - 2,919 m', mirip(k1, 2.46) && mirip(k2, 2.919), `${k1.toFixed(3)} - ${k2.toFixed(3)}`);
const tanpaKoreksi = jarakUntukLebar({ ...rq50k, koreksiJarak: undefined }, W100);
cek('tanpa koreksi b (L = TR x W) jarak meleset ±7% - koreksi memang perlu', !mirip(tanpaKoreksi[0], 1.189, 0.05), `${tanpaKoreksi[0].toFixed(3)}`);

console.log('\n3. Iluminansi, luminance & kontras pusat gambar');
const lux = 51000 / (W100 * H100);
cek('iluminansi = lumen / luas gambar ±19.117 lux', mirip(lux, 19117));
cek('luminance = lux x gain / π ±6.085 cd/m²', mirip(luminanceDari(19117, 1), 6085));
cek('kontras = (lux gambar + 200) / 200 ±96 : 1', Math.floor((19117 + 200) / 200) === 96);
cek('gain 1,3 menaikkan luminance 30%, kontras tidak berubah', mirip(luminanceDari(19117, 1.3), 6085 * 1.3));

console.log('\n4. Mesin sinar Desain 3D memakai rumus yang sama');
//  Layar 100" di dinding depan, proyektor menghadap layar pada jarak lensa 1,189 m.
const layar: Benda = { ...bendaBaru('layar', K, { diag: 100, rasio: '16:9' } as Partial<Benda>), x: 5, z: 0.05, elev: 0.8, rot: 0, gainLayar: 1.2 };
const mukaLayar = keDunia(layar, [0, layar.h / 2, layar.d / 2])[2];
const p0 = { ...rq50k, x: 5, z: 3, elev: 1.2 };
const lensaZ = keDunia(p0, lensaProyektor(p0))[2];
const p = { ...p0, z: p0.z + (mukaLayar + 1.189) - lensaZ };
const sn = sinarProyektor(p, [layar, p], ruang);
cek('jarak lempar dari ujung lensa = 1,189 m', mirip(sn.jarak, 1.189, 0.002), sn.jarak.toFixed(4));
cek('lebar gambar di layar = 2,245 m (L + b) / TR', mirip(sn.lebar, W100), sn.lebar.toFixed(4));
cek('throw ratio "pas layar" memakai L + b', mirip(sn.trPas ?? 0, (sn.jarak + 0.082) / Math.max(layar.w, layar.h / (9 / 17)), 1e-6));
const L = lensaDari(p);
const pojok = sn.sudut.map(s => keGambar(L, s));
cek('pojok gambar sinarProyektor tepat di tepi kerucut sinar (puncak b di belakang lensa) - kanvas & hitungan sama',
  pojok.every(g => !!g && Math.abs(Math.abs(g.u) - 0.5) < 0.01 && Math.abs(Math.abs(g.v) - 0.5) < 0.01),
  pojok.map(g => g && `${g.u.toFixed(3)},${g.v.toFixed(3)}`).join(' '));
const kp = kontrasProyektor(p, [layar, p], ruang, 15);
cek('panel kontras: luminance = lux x gain layar (1,2) / π', mirip(kp.luminance, (kp.luxGambar * 1.2) / Math.PI, 1e-9) && kp.gain === 1.2);

console.log('\n5. Pasang ke layar otomatis dengan koreksi jarak');
const pas = proyektorKeLayar({ ...rq50k, x: 5, z: 6, elev: 1.2 }, layar, K, ruang);
const snPas = sinarProyektor(pas, [layar, pas], ruang);
const lebarPerlu = Math.max(layar.w, layar.h / rasioGambarProyektor(rq50k));
cek('gambar tepat selebar yang diperlukan layar (±1 cm)', Math.abs(snPas.lebar - lebarPerlu) < 0.01, `${snPas.lebar.toFixed(3)} vs ${lebarPerlu.toFixed(3)}`);
//  Posisi hasil pasang dibulatkan ke 1 cm (bulat2), jadi jarak boleh selisih <= 5 mm.
cek('jarak lensa = TR x lebar - b (posisi dibulatkan 1 cm)', Math.abs(snPas.jarak - ((pas.throwRatio ?? 0) * lebarPerlu - 0.082)) <= 0.006, `${snPas.jarak.toFixed(4)}`);

console.log('\n6. Batas lens shift datasheet');
cek('tanpa batas: tidak pernah melewati', !batasShift({ ...rq50k, offsetLensa: 1.2 }).lewatV);
cek('shift atas 50%: offset 60% melewati, 40% aman',
  batasShift({ ...rq50k, shiftAtasMaks: 0.5, offsetLensa: 0.6 }).lewatV && !batasShift({ ...rq50k, shiftAtasMaks: 0.5, offsetLensa: 0.4 }).lewatV);
cek('shift kiri-kanan 17%: geser 20% melewati', batasShift({ ...rq50k, shiftHMaks: 0.17, geserLensaH: -0.2 }).lewatH);
const terbatas = proyektorKeLayar({ ...rq50k, shiftAtasMaks: 0.2, offsetLensa: 0, x: 5, z: 6, elev: 1.2 }, layar, K, ruang);
cek('pasang otomatis tidak memakai lens shift melebihi batas lensa', (terbatas.offsetLensa ?? 0) <= 0.2 + 1e-9, `${terbatas.offsetLensa}`);

console.log('\n7. Pustaka: batas shift, koreksi jarak & Native 4K');
const entri: EntriPustaka = { id: 'rq50k', jenis: 'proyektor', nama: 'PT-RQ50K + ET-D3QW200', data: {
  lumen: 50000, throwMin: 0.566, throwMaks: 0.669, resolusi: '4KDCI', shiftAtas: 50, shiftBawah: 8, shiftHorizontal: 17, koreksiJarak: 0.082 } };
const isi = isiDariPustaka(bendaBaru('proyektor', K), entri)!;
cek('resolusi 4096 x 2160 -> rasio 17:9', isi.rasioProyektor === '17:9');
cek('shift atas 50% / bawah 8% / kiri-kanan 17% -> batas 0,5 / 0,08 / 0,17', isi.shiftAtasMaks === 0.5 && isi.shiftBawahMaks === 0.08 && isi.shiftHMaks === 0.17);
cek('koreksi jarak 0,082 m ikut', isi.koreksiJarak === 0.082);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
