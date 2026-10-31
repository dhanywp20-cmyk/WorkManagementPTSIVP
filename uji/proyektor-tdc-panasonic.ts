/**
 * uji/proyektor-tdc-panasonic.ts - Desain 3D = Panasonic Throw Distance Calculator (TDC 2.79) PERSIS.
 *
 * Acuan (hasil kalkulator Panasonic resmi): PT-VMZ51, Supplied lens, 16:9, 123,83"
 *   Projection size     : H 1,542 m, W 2,741 m
 *   Projection distance : L 3,000 – 4,850 m
 *   Lens shift          : VS1 0,44 x H, HS1 0,20 x W
 *   Brightness          : Projector output 4.680 lm, Screen illuminance 1.107 lx
 * Plus: keterangan kanvas & panel memakai fungsi yang sama (hasilPanasonic), katalog = data Panasonic.
 *
 * Jalankan: npx tsx uji/proyektor-tdc-panasonic.ts
 */
import katalog from '../lib/data/panasonic-tdc.json';
import { readFileSync } from 'node:fs';
import {
  batasShift, bendaBaru, daftarRuang, gantiRasioProyektor, hasilPadaJarak, hasilPanasonic, isiDariKatalog, jarakProyeksi, type KatalogTdc,
  aturJarakProyeksi, kontrasProyektor, LENSA_MZ882, lensaPadaRasio, RASIO_PROYEKTOR, resolusiProyektorDari, sinarProyektor, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { ukuranDariDiagonal } from '../lib/av-hitung';
import { rentangJarakLempar, rumusLensaDariDuaTitik } from '../lib/av-layar-proyektor';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const K = katalog as unknown as KatalogTdc;
const ruang: Ruang = { p: 12, l: 12, t: 4, lantai: 'polos', r2: null };
const kotak = daftarRuang(ruang)[0];

console.log('\n1. Katalog resmi Panasonic');
const vmz51 = K.model.find(m => m.n === 'PT-VMZ51')!;
cek(`${K.model.length} model, PT-VMZ51 ada (5.200 lm, panel 16:10 WUXGA)`, K.model.length > 250 && !!vmz51 && vmz51.lm === 5200 && vmz51.a === '16:10' && vmz51.r === 'WUXGA');
const mz882 = K.model.find(m => m.n === 'PT-MZ882')!.l.find(l => l.n.includes('ET-ELS20'))!;
const [trW, , bW, bT] = mz882.ar['16:10']!;
cek('PT-MZ882 + ET-ELS20 = Pustaka 057 (TR 1,639108, b 0,054882 / 0,048228)', Math.abs(trW - LENSA_MZ882.ELS20.trMin) < 2e-5 && bW === LENSA_MZ882.ELS20.koreksiJarak && bT === LENSA_MZ882.ELS20.koreksiJarakTele);

console.log('\n2. PT-VMZ51 16:9 123,83" (screenshot kalkulator Panasonic)');
const dasar = { ...bendaBaru('proyektor', kotak, { pasangProyektor: 'plafon' }), id: 'p', rasioProyektor: '16:9' } as Benda;
const p: Benda = { ...dasar, ...isiDariKatalog({ ...dasar, throwRatio: 0 }, vmz51, vmz51.l[0], '16:9', K.versi), offsetLensa: 0, geserLensaH: 0 };
cek('lensa dipasang di zoom terlebar, rasio 16:9, panel WUXGA', p.throwRatio === p.trMin && p.rasioProyektor === '16:9' && p.resolusiProyektor === 'WUXGA');
const W = 123.83 * 0.0254 * 16 / Math.hypot(16, 9);
const hw = hasilPadaJarak(p, 3.0);
cek(`L 3,000 m -> W ${r3(hw.lebar)} m (2,741)`, r3(hw.lebar) === 2.741);
cek(`H ${r3(hw.tinggi)} m (1,542)`, r3(hw.tinggi) === 1.542);
cek(`diagonal ${hw.diagonalInci.toFixed(2)}" (123,83)`, Math.abs(hw.diagonalInci - 123.83) < 0.01);
const hl = hasilPadaJarak(p, 3.0);
cek(`L zoom wide - tele untuk 123,83": ${r3(hl.rentangL[0])} - ${r3(hl.rentangL[1])} m (3,000 - 4,850)`, r3(hasilPadaJarak(p, 3).rentangL[0]) === 3 && r3(hasilPadaJarak({ ...p }, 3).rentangL[1]) === 4.85);
cek('rentang dari lebar tepat 123,83" juga 3,000 - 4,850', (() => { const pp = { ...p }; const L0 = pp.trMin! * W - (pp.koreksiJarak ?? 0), L1 = pp.trMax! * W - (pp.koreksiJarakTele ?? 0); return r3(L0) === 3 && r3(L1) === 4.85; })());
cek(`Projector output ${Math.round(hw.lumenGambar)} lm (4.680)`, Math.round(hw.lumenGambar) === 4680);
cek(`Screen illuminance ${Math.round(hw.lux!)} lx (1.107)`, Math.round(hw.lux!) === 1107);
cek(`VS1 ${r3(hw.vsAtas!)} m ≈ 0,44 x H panel; HS1 ${r3(hw.hs!)} m ≈ 0,20 x W panel (letterbox 16:9)`,
  Math.abs(hw.vsAtas! - (0.94 - 0.45) / 0.9 * hw.tinggi) < 0.002 && Math.abs(hw.hs! - 0.2 * hw.lebar) < 0.002, `${hw.vsAtas} ${hw.hs}`);
const p1610 = { ...p, ...gantiRasioProyektor(p, '16:10') };
const h1610 = hasilPadaJarak(p1610, 3.0);
cek('rasio 16:10 (native): output 5.200 lm penuh, VS1 = 0,44 x H, HS1 = 0,20 x W', Math.round(h1610.lumenGambar) === 5200 && Math.abs(h1610.vsAtas! - 0.44 * h1610.tinggi) < 1e-3 && Math.abs(h1610.hs! - 0.2 * h1610.lebar) < 1e-3);
cek('ganti rasio memakai koefisien Panasonic rasio itu (TR 1,105057 di 16:10)', p1610.trMin === 1.105057 && p1610.koreksiJarak === 0.0294);
cek('piksel aktif blending 16:9 di WUXGA = 1920 × 1080', resolusiProyektorDari(p)?.x === 1920 && resolusiProyektorDari(p)?.y === 1080);

console.log('\n3. Di ruang 3D: panel, kanvas & kalkulator sama');
const layar: Benda = { ...bendaBaru('layar', kotak), id: 'l', x: 6, z: 0.05, elev: 0.6, rot: 0, w: 2.741, h: 1.542, d: 0.04 };
const awal: Benda = { ...p, x: 6, z: 5, elev: 2.6, rot: 180, tilt: 0, offsetLensa: 0.5 };
const pos = aturJarakProyeksi(awal, [layar, awal], ruang, 3.0)!;
const q = { ...awal, ...pos };
const h = hasilPanasonic(q, [layar, q], ruang);
cek(`L tepat 3,000 m ke layar (${h.L?.toFixed(4)})`, h.sasaran?.id === 'l' && Math.abs(h.L! - 3) < 1e-9);
cek('ukuran & lux = kalkulator walau lens shift 50% (dulu kanvas memakai jarak miring 3,12 m)', r3(h.lebar) === 2.741 && r3(h.tinggi) === 1.542 && Math.round(h.lux!) === 1107);
const sn = sinarProyektor(q, [layar, q], ruang);
cek('sinar kanvas: jarak & lebar gambar sama dengan hasil', Math.abs(sn.jarak - h.L!) < 1e-9 && Math.abs(sn.lebar - h.lebar) < 1e-9);
cek('kontras panel memakai lux yang sama', Math.abs(kontrasProyektor(q, [layar, q], ruang, 15).luxGambar - h.lux!) < 1e-6);
cek('jarakProyeksi = L hasil', jarakProyeksi(q, [layar, q], ruang).jarak === h.L);
const dinding = { ...q, rot: 90 };
const hd = hasilPanasonic(dinding, [dinding], ruang), sd = sinarProyektor(dinding, [dinding], ruang);
cek('ke dinding: L sama dengan sinar (tanpa potongan 5 mm di ukuran)', Math.abs((hd.L ?? 0) - sd.jarak) < 1e-9 && Math.abs(hd.lebar - sd.lebar) < 1e-9);
const src = readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/sinar.ts', 'utf8');
cek('keterangan kanvas memakai hasilPanasonic (bukan distanceTo miring)', /hasilPanasonic\(p, benda, ruang\)/.test(src) && !/tengah\.distanceTo\(O\)/.test(src));

console.log('\n4. Lens shift poligon VMZ51 (UP saja)');
const bs = batasShift(p1610);
cek(`16:10: atas ${bs.atas}, bawah ${bs.bawah}, h ${bs.h} (0,44 / 0 / 0,2)`, bs.atas === 0.44 && bs.bawah === 0 && bs.h === 0.2);

console.log('\n5. PT-VMZ61 16:9 L 4,000 m (screenshot kalkulator Panasonic) - Desain 3D & Kalkulator AV - Proyektor');
//  Acuan: Diagonal 4,183 m / 164,70", H 2,051, W 3,646, L 4,000 – 6,462, Projector output 5.580 lm, 746 lx.
const vmz61 = K.model.find(m => m.n === 'PT-VMZ61')!;
const p61: Benda = { ...dasar, ...isiDariKatalog({ ...dasar, throwRatio: 0 }, vmz61, vmz61.l[0], '16:9', K.versi) };
const h61 = hasilPadaJarak(p61, 4.0);
cek(`Desain 3D: W ${r3(h61.lebar)} × H ${r3(h61.tinggi)} m, ${h61.diagonalInci.toFixed(2)}" (3,646 × 2,051, 164,70")`,
  r3(h61.lebar) === 3.646 && r3(h61.tinggi) === 2.051 && h61.diagonalInci.toFixed(2) === '164.70');
cek(`Desain 3D: L ${r3(h61.rentangL[0])} – ${r3(h61.rentangL[1])} m, ${Math.round(h61.lumenGambar)} lm, ${Math.round(h61.lux!)} lx (4,000 – 6,462, 5.580, 746)`,
  r3(h61.rentangL[0]) === 4 && r3(h61.rentangL[1]) === 6.462 && Math.round(h61.lumenGambar) === 5580 && Math.round(h61.lux!) === 746);
//  Jalur Kalkulator AV: diagonal (inci) + rasio -> ukuran, rentangJarakLempar dengan TR & b lensaPadaRasio, lumen x bagian panel.
const lv = lensaPadaRasio(vmz61, vmz61.l[0], '16:9');
const uk = ukuranDariDiagonal(164.70, RASIO_PROYEKTOR['16:9'].lebar, RASIO_PROYEKTOR['16:9'].tinggi);
const lempar = rentangJarakLempar(uk.lebarM, lv.trW, lv.trT, lv.bW, lv.bT);
const outAV = vmz61.lm * lv.bagian.lebar * lv.bagian.tinggi;
cek(`Kalkulator AV: 164,70" -> ${r3(uk.lebarM)} × ${r3(uk.tinggiM)} m, L ${r3(lempar.dekatM)} – ${r3(lempar.jauhM)} m`,
  r3(uk.lebarM) === 3.646 && r3(uk.tinggiM) === 2.051 && r3(lempar.dekatM) === 4 && r3(lempar.jauhM) === 6.462);
cek(`Kalkulator AV: output ${Math.round(outAV)} lm, ${Math.round(outAV / (uk.lebarM * uk.tinggiM))} lx (5.580, 746)`,
  Math.round(outAV) === 5580 && Math.round(outAV / (uk.lebarM * uk.tinggiM)) === 746);
cek('lens shift AV = Desain 3D (poligon, letterbox 16:9)', !!lv.shift && Math.abs(lv.shift.atas - batasShift(p61).atas!) < 1e-9 && Math.abs(lv.shift.h - batasShift(p61).h!) < 1e-9);
cek('21:9 = 64:27 (sama dengan kalkulator Panasonic)', RASIO_PROYEKTOR['21:9'].lebar / RASIO_PROYEKTOR['21:9'].tinggi === 64 / 27);
const srcAV = readFileSync('app/(portal)/tools-team/_components/av/KalkulatorProyektor.tsx', 'utf8');
cek('Kalkulator AV memakai lensaPadaRasio, lumen x bagian panel & tabel rasio Desain 3D',
  /lensaPadaRasio\(/.test(srcAV) && /model\.lumen \* bagianLuas/.test(srcAV) && /RASIO_PROYEKTOR as RASIO_GAMBAR/.test(srcAV) && !/from '\.\/KalkulatorLayar'/.test(srcAV));

console.log('\n6. Proyektor CUSTOM (di luar katalog / Pustaka): TR brosur vs rumus dari kalkulator pabrikan');
//  Contoh "laser 6.000 lm" diubah ke TR brosur VMZ61 1,09 tanpa b: L 4,000 -> W 3,670, Panasonic 3,646 (selisih 2,4 cm).
const custom: Benda = { ...dasar, rasioProyektor: '16:9', trMin: 1.09, trMax: 1.77, throwRatio: 1.09, koreksiJarak: undefined, koreksiJarakTele: undefined, lumen: 6200, resolusiProyektor: 'WUXGA' };
cek(`TR brosur 1,09 tanpa b: W ${r3(hasilPadaJarak(custom, 4).lebar)} m - meleset ${(hasilPadaJarak(custom, 4).lebar - 3.646).toFixed(3)} m dari Panasonic (sebab selisih "beberapa cm")`,
  r3(hasilPadaJarak(custom, 4).lebar) === 3.67);
//  Dua hasil kalkulator Panasonic VMZ61 16:9 zoom Minimum: 100" & 200" (Width & L Minimum di layar hasil).
const W100 = 100 * 0.0254 * 16 / Math.hypot(16, 9), W200 = 2 * W100;
const L100 = 1.105112 * W100 - 0.0294, L200 = 1.105112 * W200 - 0.0294;
const rumus = rumusLensaDariDuaTitik(r3(W100), r3(L100), r3(W200), r3(L200))!;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const custom2: Benda = { ...custom, trMin: r6(rumus.tr), throwRatio: r6(rumus.tr), koreksiJarak: r6(rumus.b) };
const hc = hasilPadaJarak(custom2, 4);
cek(`rumus dari 2 hasil kalkulator (angka 3 desimal layar Panasonic): TR ${rumus.tr.toFixed(4)} b ${rumus.b.toFixed(4)} -> W ${r3(hc.lebar)} × H ${r3(hc.tinggi)} m di L 4,000 (3,646 × 2,051)`,
  r3(hc.lebar) === 3.646 && r3(hc.tinggi) === 2.051, `${hc.lebar} ${rumus.tr} ${rumus.b}`);
cek('Desain 3D Atur proyektor & Kalkulator AV memakai alat rumus yang sama (RumusLensaPabrikan)',
  /<RumusLensaPabrikan/.test(readFileSync('app/(portal)/tools-team/_components/desain3d/panel/benda/AturProyektor.tsx', 'utf8')) && /<RumusLensaPabrikan/.test(srcAV));

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
