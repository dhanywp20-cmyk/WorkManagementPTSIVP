/**
 * uji/proyektor-panasonic-data.ts - model Panasonic di Pustaka (migrasi 057) dibandingkan dengan rumus kalkulator
 * Panasonic sendiri (Throw Distance Calculator 2.79): L = A x diagonal(inci) - B di ujung wide & tele.
 *
 * Batas pemilik: simulasi kita tidak boleh selisih lebih dari 2 cm dari simulasi bawaan brand. Diperiksa di
 * Kalkulator Proyektor (lib/av-layar-proyektor.ts) DAN Desain 3D (inti/proyektor.ts lewat isiDariPustaka), untuk
 * seluruh rentang ukuran layar tiap lensa. Juga: kasus screenshot pemilik (PT-MZ882 127,71"), lens shift segi
 * delapan, proyektor tanpa lens shift, dan pergantian model.
 *
 * Jalankan: npx tsx uji/proyektor-panasonic-data.ts
 */
import { readFileSync } from 'fs';
import { lumenUntukKontras, rentangJarakLempar } from '../lib/av-layar-proyektor';
import { ukuranDariDiagonal } from '../lib/av-hitung';
import type { EntriPustaka } from '../lib/pustaka';
import {
  batasShift, bendaBaru, isiDariPustaka, jarakUntukLebar, koreksiJarakDari, offsetLensaDari, shiftMuat, type Benda,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const BATAS = 0.02;

/** Koefisien mentah kalkulator Panasonic (rasio native) & rentang layar lensa (inci) - acuan, terpisah dari migrasi. */
const ACUAN: Record<string, { A1: number; B1: number; A2: number; B2: number; rasio: [number, number]; layar: [number, number] }> = {
  'Panasonic PT-MZ882 + lensa standar ET-ELS20': { A1: 0.035305, B1: 0.054882, A2: 0.060045, B2: 0.048228, rasio: [16, 10], layar: [40, 400] },
  'Panasonic PT-MZ882 + ET-ELU20 (ultra short throw)': { A1: 0.007286, B1: 0.029388, A2: 0.007844, B2: 0.034616, rasio: [16, 10], layar: [100, 400] },
  'Panasonic PT-MZ882 + ET-ELW22': { A1: 0.017536, B1: 0.04846, A2: 0.021737, B2: 0.045477, rasio: [16, 10], layar: [60, 400] },
  'Panasonic PT-MZ882 + ET-ELW20': { A1: 0.026816, B1: 0.055497, A2: 0.036511, B2: 0.0534, rasio: [16, 10], layar: [40, 400] },
  'Panasonic PT-MZ882 + ET-ELT22': { A1: 0.060102, B1: 0.114022, A2: 0.098001, B2: 0.112874, rasio: [16, 10], layar: [40, 400] },
  'Panasonic PT-MZ882 + ET-ELT23': { A1: 0.098214, B1: 0.212284, A2: 0.155996, B2: 0.210772, rasio: [16, 10], layar: [40, 400] },
  'Panasonic PT-MZ882 + ET-ELW21 (fixed)': { A1: 0.017178, B1: 0.057678, A2: 0.017178, B2: 0.057678, rasio: [16, 10], layar: [40, 400] },
  'Panasonic PT-LMX460': { A1: 0.030094, B1: 0.0265, A2: 0.036284, B2: 0.0265, rasio: [4, 3], layar: [30, 300] },
  'Panasonic PT-TMZ400 (short throw)': { A1: 0.009586, B1: 0.0332, A2: 0.009586, B2: 0.0332, rasio: [16, 10], layar: [50, 105] },
};

//  Entri persis seperti yang akan ada di tabel tools_pustaka (dibaca dari berkas migrasinya).
const sql = readFileSync('supabase/migrations/057_pustaka_proyektor_panasonic.sql', 'utf8');
const entri: EntriPustaka[] = [...sql.matchAll(/\('proyektor', '((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)]
  .map((m, i) => ({ id: `e${i}`, jenis: 'proyektor', nama: m[1].replace(/''/g, "'"), data: JSON.parse(m[2].replace(/''/g, "'")) }));
const K = { x0: 0, p: 10, l: 10, t: 4 };
const proyektor = (e: EntriPustaka): Benda => {
  const b = bendaBaru('proyektor', K, { pasangProyektor: 'meja' });
  return { ...b, ...isiDariPustaka(b, e) } as Benda;
};

console.log(`\n1. Jarak lempar vs rumus Panasonic (batas ${BATAS * 100} cm), ${entri.length} model`);
cek('migrasi memuat 9 model yang diuji', entri.length === 9 && entri.every(e => ACUAN[e.nama]));
for (const e of entri) {
  const a = ACUAN[e.nama];
  const [w, h] = a.rasio;
  let maksKalk = 0, maks3D = 0;
  //  Seluruh rentang layar lensa, 25 titik.
  for (let i = 0; i <= 24; i++) {
    const diag = a.layar[0] + ((a.layar[1] - a.layar[0]) * i) / 24;
    const lebar = ukuranDariDiagonal(diag, w, h).lebarM;
    const panasonic = [a.A1 * diag - a.B1, a.A2 * diag - a.B2];
    const d = e.data as Record<string, number>;
    const k = rentangJarakLempar(lebar, d.throwMin, d.throwMaks, d.koreksiJarak ?? 0, d.koreksiJarakTele ?? d.koreksiJarak ?? 0);
    const j3 = jarakUntukLebar(proyektor(e), lebar);
    maksKalk = Math.max(maksKalk, Math.abs(k.dekatM - panasonic[0]), Math.abs(k.jauhM - panasonic[1]));
    maks3D = Math.max(maks3D, Math.abs(j3[0] - panasonic[0]), Math.abs(j3[1] - panasonic[1]));
  }
  cek(`${e.nama}: selisih maks Kalkulator ${(maksKalk * 1000).toFixed(2)} mm, Desain 3D ${(maks3D * 1000).toFixed(2)} mm`, maksKalk <= BATAS && maks3D <= BATAS);
}

console.log('\n2. Screenshot pemilik: PT-MZ882 lensa standar, 127,71" 16:10, 200 lux');
const mz = entri.find(e => e.nama.includes('ELS20'))!;
const lebarSS = ukuranDariDiagonal(127.71, 16, 10).lebarM, tinggiSS = (lebarSS * 10) / 16;
const jSS = jarakUntukLebar(proyektor(mz), lebarSS);
cek(`lebar 2,751 m, tinggi 1,719 m`, Math.abs(lebarSS - 2.751) < 0.001 && Math.abs(tinggiSS - 1.719) < 0.001);
cek(`jarak 4,454 - 7,62 m (kita ${jSS[0].toFixed(3)} - ${jSS[1].toFixed(3)})`, Math.abs(jSS[0] - 4.454) < 0.002 && Math.abs(jSS[1] - 7.62) < 0.002);
const lux = 8200 / (lebarSS * tinggiSS);
cek(`iluminansi pusat 1.734 lux (kita ${lux.toFixed(0)})`, Math.abs(lux - 1734) < 1);
const kontras = (lux + 200) / (lux / 3000000 + 200);
cek(`kontras 9,7 : 1 dengan kontras asli 3.000.000:1 (kita ${kontras.toFixed(2)})`, Math.abs(kontras - 9.7) < 0.05);
//  Lumen untuk kontras 9,67:1 di 200 lux harus kembali ke ±8.200 lm (rumus lumenUntukKontras dengan kontras asli).
cek('lumenUntukKontras membalik rumus yang sama (±8.200 lm)', Math.abs(lumenUntukKontras(lebarSS * tinggiSS, 200, kontras, 1, 3000000) - 8200) < 1);
cek('target melebihi kontras asli -> tidak tercapai (Infinity)', !Number.isFinite(lumenUntukKontras(4, 0.5, 2000, 1, 1500)));

console.log('\n3. Lens shift segi delapan (cara kalkulator Panasonic: semua pojok gambar di dalam poligon)');
const p = proyektor(mz);
const pg = p.poligonShift!;
cek('poligon terbaca dari Pustaka (8 titik)', pg.length === 16);
cek('vertikal −67% saja: muat', shiftMuat(pg, 0, -0.67));
cek('horizontal 35% saja: muat', shiftMuat(pg, 0.35, 0));
cek('V −67% + H 17% (screenshot, kotak Panasonic merah): TIDAK muat', !shiftMuat(pg, 0.17, -0.67));
cek('V −33,5% + H 17%: muat (17/35 + 33,5/67 < 1)', shiftMuat(pg, 0.17, -0.335));
cek('V −40% + H 20%: tidak muat (20/35 + 40/67 > 1)', !shiftMuat(pg, 0.2, -0.4));
const bs = batasShift({ ...p, offsetLensa: -0.67, geserLensaH: 0.17 });
cek(`batasShift: batas +${Math.round(bs.atas! * 100)}/−${Math.round(bs.bawah! * 100)}% ±${Math.round(bs.h! * 100)}%, kombinasi ditandai`,
  Math.round(bs.atas! * 100) === 67 && Math.round(bs.bawah! * 100) === 67 && Math.round(bs.h! * 100) === 35 && bs.lewatGabungan && !bs.lewatV && !bs.lewatH);
cek('tanpa poligon tetap pakai batas kotak lama', !batasShift({ ...p, poligonShift: undefined, offsetLensa: -0.67, geserLensaH: 0.17 }).lewatGabungan);

console.log('\n4. Proyektor tanpa lens shift & b ikut zoom');
const tmz = proyektor(entri.find(e => e.nama.includes('TMZ400'))!);
cek('PT-TMZ400: offset tetap 60,03%, shift dikunci', Math.abs(offsetLensaDari({ ...tmz, offsetLensa: 0 }) - 0.6003) < 1e-6 && batasShift(tmz).tetap);
const lmx = proyektor(entri.find(e => e.nama === 'Panasonic PT-LMX460')!);
cek('PT-LMX460: rasio 4:3 dari resolusi XGA, offset tetap 34,62%', lmx.rasioProyektor === '4:3' && Math.abs(offsetLensaDari(lmx) - 0.3462) < 1e-6);
const elt = proyektor(entri.find(e => e.nama.includes('ELT23'))!);
const tengah = (elt.trMin! + elt.trMax!) / 2;
cek('b diinterpolasi ikut zoom (tengah = rata-rata wide & tele)', Math.abs(koreksiJarakDari(elt, tengah) - (0.212284 + 0.210772) / 2) < 1e-4);

console.log('\n5. Ganti model: data lensa lama tidak tertinggal');
const ganti = { ...elt, ...isiDariPustaka(elt, entri.find(e => e.nama === 'Panasonic PT-LMX460')!) } as Benda;
cek('ELT23 -> LMX460: b tele & poligon ELT23 hilang, offset tetap terpasang', ganti.koreksiJarakTele === undefined && ganti.poligonShift === undefined && ganti.offsetTetap !== undefined);
const balik = { ...ganti, ...isiDariPustaka(ganti, mz) } as Benda;
cek('LMX460 -> MZ882: offset tetap dilepas, poligon terpasang', balik.offsetTetap === undefined && (balik.poligonShift?.length ?? 0) === 16);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
