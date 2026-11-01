/**
 * uji/desain3d-shift-otomatis.ts - tombol "Otomatis ke layar" lens shift (inti/proyektor.ts shiftOtomatis): posisi,
 * pan, tilt & zoom tetap, lens shift vertikal & horizontal diatur supaya pusat gambar tepat di pusat layar, dibatasi
 * kemampuan lensa (batas kotak atau daerah segi delapan kalkulator Panasonic).
 *
 * Jalankan: npx tsx uji/desain3d-shift-otomatis.ts
 */
import katalog from '../lib/data/panasonic-tdc.json';
import {
  batasShift, bendaBaru, daftarRuang, isiDariKatalog, sinarProyektor, shiftOtomatis, type Benda, type KatalogTdc, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}
const ruang: Ruang = { p: 12, l: 12, t: 4, lantai: 'polos', r2: null };
const K = daftarRuang(ruang)[0];
const layar: Benda = { ...bendaBaru('layar', K), id: 'layar', x: 6, z: 0.05, elev: 0.8, rot: 0, w: 2.657, h: 1.494, d: 0.04 };
const dasar: Benda = { ...bendaBaru('proyektor', K, { pasangProyektor: 'plafon' }), id: 'p', x: 6.3, z: 5, elev: 2.9, rot: 180, tilt: 0, offsetLensa: 0, geserLensaH: 0 };
const selisih = (p: Benda) => sinarProyektor(p, [layar, p], ruang);

console.log('\n1. Tanpa batas lensa: pusat gambar tepat di pusat layar');
const h1 = shiftOtomatis(dasar, [layar, dasar], ruang)!;
const s1 = selisih({ ...dasar, offsetLensa: h1.offsetLensa, geserLensaH: h1.geserLensaH });
cek(`vertikal tepat (selisih ${(s1.selisihV! * 1000).toFixed(1)} mm)`, Math.abs(s1.selisihV!) < 0.003);
cek(`horizontal tepat - proyektor 30 cm di kanan tengah layar (selisih ${(s1.selisihH! * 1000).toFixed(1)} mm)`, Math.abs(s1.selisihH!) < 0.003);
cek('shift horizontal ke kiri (negatif)', h1.geserLensaH < 0, String(h1.geserLensaH));
cek('posisi, pan, tilt & zoom tidak diubah (yang dikembalikan hanya shift)', Object.keys(h1).sort().join() === 'geserLensaH,offsetLensa,sisaH,sisaV');
cek('sisa ~0 dilaporkan', Math.abs(h1.sisaV) < 0.003 && Math.abs(h1.sisaH) < 0.003);

console.log('\n2. Batas kotak (datasheet / Pustaka) dipatuhi');
const kotak: Benda = { ...dasar, shiftAtasMaks: 0.3, shiftBawahMaks: 0, shiftHMaks: 0.05 };
const h2 = shiftOtomatis(kotak, [layar, kotak], ruang)!;
cek(`vertikal dijepit di batas atas 30% (${(h2.offsetLensa * 100).toFixed(1)}%)`, h2.offsetLensa <= 0.3 + 1e-9 && h2.offsetLensa > 0.29);
cek(`horizontal dijepit ±5% (${(h2.geserLensaH * 100).toFixed(1)}%)`, Math.abs(h2.geserLensaH) <= 0.05 + 1e-9);
cek('hasil tidak melewati batas lensa', (() => { const b = batasShift({ ...kotak, ...h2 }); return !b.lewatV && !b.lewatH; })());
cek('sisa yang tidak tercapai dilaporkan (> 1 cm)', Math.abs(h2.sisaV) > 0.01 && Math.abs(h2.sisaH) > 0.01, `${h2.sisaV.toFixed(3)} / ${h2.sisaH.toFixed(3)}`);
cek('batas bawah 0 = tidak bisa shift ke bawah (bukan "tidak dibatasi")', batasShift({ ...kotak, offsetLensa: -0.1 }).lewatV);

console.log('\n3. PT-VMZ61 + Supplied lens (daerah segi delapan kalkulator Panasonic)');
const m = (katalog as unknown as KatalogTdc).model.find(x => x.n === 'PT-VMZ61')!;
const vmz: Benda = { ...dasar, ...isiDariKatalog(dasar, m, m.l[0], '16:10') } as Benda;
const bv = batasShift(vmz);
cek(`batas terisi dari katalog: atas +${Math.round(bv.atas! * 100)}%, bawah ${Math.round(bv.bawah! * 100)}%, kiri-kanan ±${Math.round(bv.h! * 100)}%`, bv.atas! > 0.43 && bv.atas! < 0.45 && bv.bawah === 0 && bv.h! > 0.19);
const h3 = shiftOtomatis(vmz, [layar, vmz], ruang)!;
const b3 = batasShift({ ...vmz, offsetLensa: h3.offsetLensa, geserLensaH: h3.geserLensaH });
cek(`hasil di dalam daerah lensa (V ${(h3.offsetLensa * 100).toFixed(1)}%, H ${(h3.geserLensaH * 100).toFixed(1)}%)`, !b3.lewatV && !b3.lewatH && !b3.lewatGabungan);
//  Ketinggian yang shift-nya masih muat (vertikal ~30%, horizontal kecil): harus tepat di tengah layar.
const tanpaBatas = (e: number) => { const q = { ...vmz, x: 6.05, elev: e, poligonShift: undefined }; return shiftOtomatis(q, [layar, q], ruang)!.offsetLensa; };
let elev = 2.9;
while (elev > 1 && tanpaBatas(elev) > 0.3) elev -= 0.01;
const dekat: Benda = { ...vmz, x: 6.05, elev };
const h4 = shiftOtomatis(dekat, [layar, dekat], ruang)!;
cek(`muat penuh -> tepat di tengah layar (sisa ${(Math.hypot(h4.sisaV, h4.sisaH) * 1000).toFixed(1)} mm)`, Math.hypot(h4.sisaV, h4.sisaH) < 0.005);

console.log('\n4. Tanpa layar / tanpa lens shift');
cek('tanpa layar di depan lensa -> null', shiftOtomatis({ ...dasar, rot: 0 }, [layar, { ...dasar, rot: 0 }], ruang) === null);
cek('proyektor offset tetap (tanpa lens shift) -> null', shiftOtomatis({ ...dasar, offsetTetap: 0.5 }, [layar, dasar], ruang) === null);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
