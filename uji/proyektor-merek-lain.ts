/**
 * uji/proyektor-merek-lain.ts - katalog proyektor merek SELAIN Panasonic (desain3d/inti/katalogLain.ts):
 *   Epson    dari Projector Throw Distance Simulator (lib/data/epson-tdc.json)
 *   Vivitek  dari Projection Simulator               (lib/data/vivitek-tdc.json)
 * Angka jarak dibandingkan dengan rumus kalkulator merek itu sendiri (koefisien mentah ditulis di sini sebagai acuan),
 * lens shift (segi delapan Epson, offset + shift satu arah Vivitek), lumen per lensa, dan katalog Panasonic TIDAK berubah.
 *
 * Jalankan: npx tsx uji/proyektor-merek-lain.ts
 */
import epson from '../lib/data/epson-tdc.json';
import vivitek from '../lib/data/vivitek-tdc.json';
import panasonic from '../lib/data/panasonic-tdc.json';
import { bacaKoefRasio } from '../lib/pustaka';
import {
  batasShift, bendaBaru, daftarRuang, isiDariKatalog, isiDariKatalogLain, type KatalogLain, type KatalogTdc, lensaPadaRasio, lensaPadaRasioLain,
  RASIO_PROYEKTOR, type RasioProyektor, shiftMuat, shiftOtomatis, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}
const E = epson as unknown as KatalogLain, V = vivitek as unknown as KatalogLain, P = panasonic as unknown as KatalogTdc;
/** Lebar gambar (m) layar `d` inci pada rasio. */
const lebar = (d: number, r: RasioProyektor) => { const { lebar: w, tinggi: h } = RASIO_PROYEKTOR[r]; return (d * 0.0254 * w) / Math.hypot(w, h); };
const L = (tr: number, b: number, d: number, r: RasioProyektor) => tr * lebar(d, r) - b;

console.log('\n1. Epson EB-L610U = rumus simulator Epson L(cm) = a x diagonal + b (koefisien mentah size2dist)');
const l610 = E.model.find(m => m.n === 'EB-L610U')!;
const MENTAH: [RasioProyektor, number, number, number, number][] = [
  ['16:10', 2.95848, -3.5728, 4.7743, -3.5078], ['4:3', 3.34923, -3.5728, 5.40488, -3.5078], ['16:9', 3.04074, -3.5728, 4.90704, -3.5078],
];
for (const [r, aW, bW, aT, bT] of MENTAH) {
  const x = lensaPadaRasio(l610, l610.l[0], r);
  let maks = 0;
  for (let d = 50; d <= 500; d += 5) {
    maks = Math.max(maks, Math.abs(L(x.trW, x.bW, d, r) - (aW * d + bW) / 100), Math.abs(L(x.trT, x.bT, d, r) - (aT * d + bT) / 100));
  }
  cek(`${r} wide & tele 50-500": selisih maks ${(maks * 1000).toFixed(3)} mm`, maks < 0.0005);
}
cek('100" 16:10 wide = 2,9228 m (kalkulator Epson 292,28 cm)', Math.abs(L(lensaPadaRasio(l610, l610.l[0], '16:10').trW, lensaPadaRasio(l610, l610.l[0], '16:10').bW, 100, '16:10') - 2.92276) < 0.0005);

console.log('\n2. Lens shift Epson: V ±50%, H ±20%, H penuh -> V hanya ±12% (segi delapan simulator Epson)');
const pg = l610.l[0].pg!;
const bL = lensaPadaRasioLain(l610, l610.l[0], '16:10').shift!;
cek(`batas atas / bawah / kiri-kanan = 50 / 50 / 20% (${Math.round(bL.atas * 100)} / ${Math.round(bL.bawah * 100)} / ${Math.round(bL.h * 100)})`, Math.abs(bL.atas - 0.5) < 0.002 && Math.abs(bL.bawah - 0.5) < 0.002 && Math.abs(bL.h - 0.2) < 0.002);
cek('H 20% + V 12% muat', shiftMuat(pg, 0.2, 0.12));
cek('H 20% + V 14% di luar (kombinasi dibatasi)', !shiftMuat(pg, 0.2, 0.14));
cek('V 50% (H 0) muat, V 52% di luar', shiftMuat(pg, 0, 0.5) && !shiftMuat(pg, 0, 0.52));

console.log('\n3. Epson lensa opsional: lumen per kombinasi proyektor + lensa');
const g69 = E.model.find(m => m.n === 'EB-G6970WU')!;
const ust = g69.l.find(l => l.n.startsWith('ELPLU01'))!;
const dasarK = daftarRuang({ p: 10, l: 10, t: 3, lantai: 'polos', r2: null })[0];
const pb: Benda = { ...bendaBaru('proyektor', dasarK, { pasangProyektor: 'plafon' }), id: 'p' };
const isiG = isiDariKatalogLain(pb, E, g69, ust, '16:10');
cek(`lumen dengan ELPLU01 = 4.600 lm (model 6.000 lm) - ${isiG.lumen}`, isiG.lumen === 4600 && g69.lm === 6000);
cek(`nama & sumber merek Epson ("${isiG.nama}", "${isiG.sumberLensa}")`, isiG.nama === 'Epson EB-G6970WU + ELPLU01 (Short)' && isiG.sumberLensa === `Epson TDC ${E.versi}`);
cek('panel native EB-G6970WU 16:10 WUXGA', g69.a === '16:10' && g69.r === 'WUXGA');

console.log('\n4. Vivitek: lebar gambar = jarak / throw ratio (b = 0)');
const du8 = V.model.find(m => m.n === 'DU8190Z')!;
const st = du8.l.find(l => l.n.startsWith('D88-ST001'))!;
const x8 = lensaPadaRasio(du8, st, '16:10');
cek(`D88-ST001 TR 1,73-2,27, b 0 (${x8.trW}-${x8.trT}, ${x8.bW})`, x8.trW === 1.73 && x8.trT === 2.27 && x8.bW === 0);
cek('16:9 di panel 16:10 (letterbox): TR terhadap lebar gambar sama', lensaPadaRasio(du8, st, '16:9').trW === 1.73);
cek('4:3 di panel 16:10 (pillarbox): TR x 1,2', Math.abs(lensaPadaRasio(du8, st, '4:3').trW - 1.73 * 1.2) < 1e-6);
//  UST: tabel TR per diagonal Vivitek (DW770UST) -> garis L = TR x W - b.
const dw = V.model.find(m => m.n === 'DW770UST')!;
const xu = lensaPadaRasio(dw, dw.l[0], '16:10');
const TABEL: [number, number][] = [[80, 0.3426], [87, 0.346], [97, 0.349], [100, 0.35]];
const sel = Math.max(...TABEL.map(([d, tr]) => Math.abs(L(xu.trW, xu.bW, d, '16:10') - tr * lebar(d, '16:10'))));
cek(`DW770UST: tabel TR UST Vivitek, selisih maks ${(sel * 1000).toFixed(2)} mm`, sel < 0.0015);
cek('lensa UST ditandai jarak khusus', dw.l[0].k === 1);

console.log('\n5. Vivitek DU3661Z: offset 117% + shift V 0..11,7% -> gambar selalu di atas sumbu lensa (58,5..70,2%)');
const du3 = V.model.find(m => m.n === 'DU3661Z')!;
const p3: Benda = { ...pb, ...isiDariKatalogLain(pb, V, du3, du3.l[0], '16:10') } as Benda;
const b3 = batasShift({ ...p3, offsetLensa: 0.6 });
cek(`batas atas 70,2%, bawah -58,5% (${(b3.atas! * 100).toFixed(1)} / ${(b3.bawah! * 100).toFixed(1)})`, Math.abs(b3.atas! - 0.702) < 0.002 && Math.abs(b3.bawah! + 0.585) < 0.002);
cek('shift 60% sah, 50% & 75% di luar', !b3.lewatV && batasShift({ ...p3, offsetLensa: 0.5 }).lewatV && batasShift({ ...p3, offsetLensa: 0.75 }).lewatV);
const ruang: Ruang = { p: 12, l: 12, t: 4, lantai: 'polos', r2: null };
const K = daftarRuang(ruang)[0];
const layar: Benda = { ...bendaBaru('layar', K), id: 'layar', x: 6, z: 0.05, elev: 0.8, rot: 0, w: 2.657, h: 1.494, d: 0.04 };
const pp: Benda = { ...p3, x: 6, z: 5, elev: 2.9, rot: 180, tilt: 0, offsetLensa: 0.6, geserLensaH: 0 };
const so = shiftOtomatis(pp, [layar, pp], ruang)!;
cek(`Otomatis ke layar tetap di daerah lensa (V ${(so.offsetLensa * 100).toFixed(1)}%)`, so.offsetLensa >= 0.585 - 1e-6 && so.offsetLensa <= 0.702 + 1e-6 && !batasShift({ ...pp, ...so }).lewatV);

console.log('\n6. Seluruh katalog: angka sah & lolos sanitasi simpan (bacaKoefRasio)');
for (const k of [E, V]) {
  let lensa = 0, rusak = 0, tanpaRasio = 0;
  for (const m of k.model) for (const l of m.l) {
    lensa++;
    const ok = bacaKoefRasio(l.ar);
    if (!ok || Object.keys(ok).length !== Object.keys(l.ar).length) rusak++;
    if (!l.ar[m.a]) tanpaRasio++;
  }
  cek(`${k.merek}: ${k.model.length} model, ${lensa} lensa - semua koefisien sah (${rusak} rusak), rasio native tersedia (${tanpaRasio} tidak)`, rusak === 0 && tanpaRasio === 0 && lensa > 0);
}
cek('Epson: >1.000 model, lensa opsional seri G / L tercakup', E.model.length > 1000 && E.model.some(m => m.l.length > 10));
cek('kategori Epson sesuai simulator (All + 6)', E.kategori.length === 7 && E.kategori[5].l === 'High Brightness (optional lenses)');

console.log('\n7. Panasonic TIDAK berubah');
const rq = P.model.find(m => m.n === 'PT-RQ32K')!;
const lq = rq.l.find(l => l.n === 'ET-D3LEU101')!;
const pq: Benda = { ...pb, ...isiDariKatalog(pb, rq, lq, rq.a, P.versi) } as Benda;
const bq = batasShift(pq);
cek('lensa Panasonic memakai batas lama (PT-RQ32K + ET-D3LEU101 tetap 0 / 0 / 0)', bq.atas === 0 && bq.bawah === 0 && bq.h === 0);
cek('nama & sumber Panasonic tetap', pq.nama === 'Panasonic PT-RQ32K + ET-D3LEU101' && pq.sumberLensa === `Panasonic TDC ${P.versi}`);
cek('katalog Panasonic tetap 290 model', P.model.length === 290);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
