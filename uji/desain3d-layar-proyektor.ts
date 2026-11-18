import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buatModel } from '../app/(portal)/tools-team/_components/desain3d/bangun';
import {
  type Benda, bendaBaru, bomDesain, daftarRuang, gainLayarDari, kontrasProyektor, PERMUKAAN_LAYAR, permukaanLayarDari, proyektorKeLayar, type Ruang, tandaBentuk,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { bersihkanAturProduk } from '../lib/tools-team';
import { bersihkanAturObjek } from '../lib/objek-saya';
import { EKSPOSUR_MIN, eksposurLayar, gulungTerang, PUTIH_LAYAR } from '../app/(portal)/tools-team/_components/desain3d/mesin/proyektorNyata';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const ruang: Ruang = { p: 6, l: 5, t: 3, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];
const layar = bendaBaru('layar', k, { diag: 120 });
const abu: Benda = { ...layar, permukaanLayar: 'abu' };
const proyektor = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), layar, k, ruang);

console.log('\n1. Layar proyektor = permukaan pasif (putih / abu-abu), tanpa konten sendiri');
cek('layar baru tidak membawa konten; default putih doff gain 1,0', layar.konten === undefined && permukaanLayarDari(layar) === 'putih' && gainLayarDari(layar) === 1);
cek('layar abu-abu: gain bawaan 0,8; gain dari datasheet tetap bisa diisi manual', gainLayarDari(abu) === 0.8 && gainLayarDari({ ...abu, gainLayar: 1.3 }) === 1.3);
cek('ganti permukaan membangun ulang model layar', tandaBentuk(abu) !== tandaBentuk(layar));

const teksturPalsu = new THREE.Texture();
const bahan = { THREE, layar: () => teksturPalsu, model: () => null } as never;
const materi = (b: Benda) => {
  const hasil: THREE.MeshStandardMaterial[] = [];
  buatModel(b, bahan).traverse(o => { const m = (o as THREE.Mesh).material; if (m) hasil.push(...(Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[]); });
  return hasil;
};
const kainDari = (b: Benda) => materi(b).find(m => m.roughness === 0.9 && m.color.r > 0.5)!;
cek('kain layar tidak pernah memakai tekstur konten (walau penyedia konten memberi gambar)', !materi(layar).some(m => m.map) && !materi({ ...layar, konten: 'dashboard' }).some(m => m.map));
const putihL = kainDari(layar).color, abuL = kainDari(abu).color;
const rasio = (abuL.r + abuL.g + abuL.b) / (putihL.r + putihL.g + putihL.b);
cek(`warna kain abu-abu memantulkan ${(rasio * 100).toFixed(0)}% dari putih (= gain 0,8 ± 2%)`, Math.abs(rasio - PERMUKAAN_LAYAR.abu.gain / PERMUKAAN_LAYAR.putih.gain) < 0.02);

console.log('\n2. Terang gambar dari proyektor: lumen, gain layar & cahaya ruangan');
const kPutih = kontrasProyektor(proyektor, [layar, proyektor], ruang, 15), kAbu = kontrasProyektor(proyektor, [abu, proyektor], ruang, 15);
cek(`luminance layar abu-abu = 0,8 × putih (${kAbu.luminance.toFixed(0)} vs ${kPutih.luminance.toFixed(0)} cd/m²)`, kPutih.gain === 1 && kAbu.gain === 0.8 && Math.abs(kAbu.luminance / kPutih.luminance - 0.8) < 1e-9);
const gelap = kontrasProyektor(proyektor, [layar, proyektor], { ...ruang, cahaya: 'gelap' }, 15), terang = kontrasProyektor(proyektor, [layar, proyektor], { ...ruang, cahaya: 'terang' }, 15);
cek(`ruangan lebih terang -> kontras gambar turun (${gelap.kontras.toFixed(1)} : 1 gelap vs ${terang.kontras.toFixed(1)} : 1 terang)`, gelap.kontras > terang.kontras);
const redup = kontrasProyektor({ ...proyektor, lumen: 2500 }, [layar, proyektor], ruang, 15);
cek('lumen proyektor lebih kecil -> gambar lebih redup', redup.luxGambar < kPutih.luxGambar && redup.kontras < kPutih.kontras);
const tampil = (amb: number, k: ReturnType<typeof kontrasProyektor>) => {
  const r = k.luxGambar / k.cahaya.total, e = eksposurLayar(amb * (1 + r));
  return { e, hitam: e * amb, putih: e * amb + gulungTerang(e * amb * r) };
};
const tTerang = tampil(0.9, terang), tGelap = tampil(0.07, gelap);
cek(`eksposur ikut layar: ruang terang -> ruangan diredupkan ke ${(tTerang.e * 100).toFixed(0)}%, putih gambar = ${PUTIH_LAYAR}, rasio putih:hitam = kontras fisik (${(tTerang.putih / tTerang.hitam).toFixed(2)} vs ${terang.kontras.toFixed(2)})`,
  tTerang.e < 1 && Math.abs(tTerang.putih - PUTIH_LAYAR) < 1e-9 && Math.abs(tTerang.putih / tTerang.hitam - terang.kontras) < 1e-6);
cek(`ruang gelap: eksposur tertahan di batas bawah ${EKSPOSUR_MIN}, gambar tetap pekat (${(tGelap.putih / tGelap.hitam).toFixed(0)} : 1)`, tGelap.e === EKSPOSUR_MIN && tGelap.putih / tGelap.hitam > 100);
cek('gambar redup (putih <= target) tidak mengubah ruangan; gulungan hanya di atas target', eksposurLayar(0.6) === 1 && gulungTerang(0.6) === 0.6 && gulungTerang(5) < 2);

console.log('\n3. BOM, produk & panel');
const bom = bomDesain([abu], []).find(r => r.item.startsWith('Layar'));
cek(`BOM layar mencatat permukaan & gain ("${bom?.catatan}")`, !!bom && /abu-abu/.test(bom.catatan) && /gain 0[.,]8/.test(bom.catatan));
cek('produk & Objek saya menyimpan permukaan layar (nilai lain dibuang)', bersihkanAturProduk({ permukaanLayar: 'abu' }).permukaanLayar === 'abu' && !('permukaanLayar' in bersihkanAturProduk({ permukaanLayar: 'hitam' }))
  && bersihkanAturObjek({ permukaanLayar: 'abu' }).permukaanLayar === 'abu');
const dir = 'app/(portal)/tools-team/_components/desain3d/';
const umum = readFileSync(`${dir}panel/benda/BagianUmum.tsx`, 'utf8'), adegan = readFileSync(`${dir}mesin/useAdegan.ts`, 'utf8');
cek('panel layar proyektor: pilihan "Permukaan layar proyektor", bukan "Konten layar"', /b\.jenis === 'layar' \? \(/.test(umum) && /Permukaan layar proyektor/.test(umum));
cek('adegan tidak lagi memberi konten ke layar proyektor di mode apa pun; TV / IFP / videowall / LED tetap memakai konten sendiri',
  /x\.jenis === 'layar' \? null : x\.konten === 'gambar' \? gambarLayar\.current\.get\(x\.id\) \?\? null : teksturKonten\(THREE, x\)/.test(adegan) && !/layarPolos/.test(adegan));

const sinarSrc = readFileSync(`${dir}mesin/sinar.ts`, 'utf8');
cek('gambar konten proyektor selalu diproyeksikan saat "Sinar proyektor" aktif; "Sinar nyata" hanya gaya sinar di udara',
  /const gambarNyata = sinar && daftarProj\.length > 0 && daftarProj\.length <= batasProyektorNyata\(m\), nyata = gambarNyata && sinarNyata;/.test(sinarSrc)
  && /if \(gambarNyata\) bahanKerucut\.opacity = Math\.sqrt\(aturLampuProyektor\(/.test(sinarSrc) && !/if \(nyata\) aturLampuProyektor/.test(sinarSrc));
cek('mode marker: isian warna penanda tidak menutupi gambar konten (hanya untuk proyektor mati)', /const adaIsi = gambarNyata && p\.konten !== 'mati';/.test(sinarSrc) && /if \(!bg\.isi\) \{/.test(sinarSrc));
cek('kerucut marker ikut eksposur; eksposur ditahan selama diseret & dihitung ulang saat dilepas',
  /bahanKerucut\.opacity = Math\.sqrt\(aturLampuProyektor\(m, lampu, kasar, menyeret\)\)/.test(sinarSrc) && /addEventListener\('dragging-changed', lepas\)/.test(adegan));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
