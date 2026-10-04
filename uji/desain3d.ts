/**
 * uji/desain3d.ts - geometri murni Desain 3D Ruang (Tools Team): salin benda
 * ke ruang sebelah, sinar & jarak lempar proyektor.
 *
 * Jalankan: npx tsx uji/desain3d.ts
 */
import {
  type Benda, type Kotak, type Ruang, bendaBaru, salinKeRuang, sinarProyektor, proyektorKeLayar, keDunia, lensaProyektor, layarTerdekat,
} from '../app/tools-team/_components/desain3d/model';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const dekat = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

const R1: Kotak = { x0: 0, p: 8, l: 6, t: 3 };

console.log('\n1. Salin ke ruang sebelah - ukuran sama');
{
  const R2: Kotak = { x0: 8, p: 8, l: 6, t: 3 };
  const meja = bendaBaru('meja', R1);
  const c = salinKeRuang(meja, R1, R2);
  cek('posisi identik, bergeser selebar ruang 1', dekat(c.x, meja.x + 8) && dekat(c.z, meja.z) && c.elev === meja.elev, `${c.x},${c.z}`);
  cek('id baru, sifat lain sama', c.id !== meja.id && c.w === meja.w && c.d === meja.d && c.bentukMeja === meja.bentukMeja && c.rot === meja.rot);
}

console.log('\n2. Salin ke ruang sebelah - ruang tujuan lebih kecil (6 x 5 m, plafon 2,8 m)');
{
  const R2: Kotak = { x0: 8, p: 6, l: 5, t: 2.8 };
  const vw = bendaBaru('videowall', R1);
  const cv = salinKeRuang(vw, R1, R2);
  cek('videowall tetap menempel dinding depan & di tengah dinding', dekat(cv.z, vw.z) && dekat(cv.x, 11), `${cv.x},${cv.z}`);
  const spk = bendaBaru('speaker-plafon', R1);
  const cs = salinKeRuang(spk, R1, R2);
  cek('speaker plafon tetap rata plafon yang lebih rendah', dekat(cs.elev + cs.h, 2.8), `${cs.elev}`);
  const proj = bendaBaru('proyektor', R1, { pasangProyektor: 'plafon' });
  const cp = salinKeRuang(proj, R1, R2);
  cek('proyektor plafon: jarak gantung dari plafon sama', dekat(2.8 - cp.elev, 3 - proj.elev), `${cp.elev}`);
  const rak = bendaBaru('rak', R1);
  const cr = salinKeRuang(rak, R1, R2);
  cek('rack di pojok kanan tetap berjarak sama dari dinding kanan', dekat(R2.x0 + R2.p - cr.x, R1.p - rak.x), `${cr.x}`);
  const meja = bendaBaru('meja', R1);
  const kursi = { ...bendaBaru('kursi', R1), x: meja.x + 1.05, z: meja.z, rot: 270 };
  const cm = salinKeRuang(meja, R1, R2), ck = salinKeRuang(kursi, R1, R2);
  cek('susunan meja-kursi tidak merapat (jarak tetap 1,05 m)', dekat(ck.x - cm.x, 1.05) && dekat(cm.x, 11), `${cm.x} ${ck.x}`);
  cek('meja tetap di dalam ruang tujuan', cm.z - cm.d / 2 >= 0 && cm.z + cm.d / 2 <= R2.l, `${cm.z}`);
  const isi = [cv, cs, cp, cr, cm, ck];
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'karpet', pintu: true } };
  cek('semua salinan jatuh di ruang 2', isi.every(b => b.x > ruang.p && b.x < ruang.p + 6));
}

console.log('\n3. Proyektor & layar');
{
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  const layar = bendaBaru('layar', R1);                     // 120" 16:9 di dinding depan
  const p0 = bendaBaru('proyektor', R1, { pasangProyektor: 'plafon' });
  const p = proyektorKeLayar(p0, layar, R1);
  const lensa = keDunia(p, lensaProyektor(p));
  cek('menghadap layar (rot 180) & lensa segaris tengah layar', p.rot === 180 && dekat(lensa[0], layar.x), `${p.rot} ${lensa[0]}`);
  const s = sinarProyektor(p, [layar, p], ruang);
  cek('sinar mengenai layar', s.layar?.id === layar.id);
  cek('jarak lempar = throw ratio x lebar layar', dekat(s.jarak, 1.6 * layar.w, 0.02), `${s.jarak}`);
  cek('gambar pas selebar layar, TR perlu = 1,6', dekat(s.lebar, layar.w, 0.02) && dekat(s.trPas ?? 0, 1.6, 0.01), `${s.lebar} ${s.trPas}`);
  cek('pojok gambar di bidang layar', s.sudut.every(t => dekat(t[2], layar.z + layar.d / 2, 0.01)), `${s.sudut[0][2]}`);
  const maju = sinarProyektor({ ...p, z: p.z - 1 }, [layar, p], ruang);
  cek('proyektor dimajukan 1 m: gambar mengecil dari layar', maju.lebar < layar.w - 0.5, `${maju.lebar}`);
  const pBalik = { ...p, rot: 0 };
  const balik = sinarProyektor(pBalik, [layar, pBalik], ruang);
  const lensaBalik = keDunia(pBalik, lensaProyektor(pBalik));
  cek('membelakangi layar: tanpa sasaran, cahaya sampai dinding belakang', balik.layar === null && dekat(balik.jarak, R1.l - lensaBalik[2], 0.01), `${balik.jarak}`);
  const meja = sinarProyektor({ ...bendaBaru('proyektor', R1, { pasangProyektor: 'meja' }), rot: 180 }, [layar], ruang);
  cek('proyektor portabel menghadap layar ikut mengenai layar', meja.layar?.id === layar.id);
}

console.log('\n4. Proyektor di ruang lain tidak menembak layar ruang 1');
{
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet', pintu: true } };
  const layar = bendaBaru('layar', R1);
  const p: Benda = { ...bendaBaru('proyektor', { x0: 8, p: 6, l: 6, t: 3 }), x: 9, rot: 180 };
  cek('tanpa sasaran', sinarProyektor(p, [layar, p], ruang).layar === null);
  cek('layar terdekat hanya di ruang yang sama', layarTerdekat(p, [layar, p], ruang) === null);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
