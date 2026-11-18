import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buatModel } from '../app/(portal)/tools-team/_components/desain3d/bangun';
import {
  type Benda, bendaBaru, bomDesain, daftarRuang, gainLayarDari, hasilPanasonic, kontrasProyektor, objekDisinari, pantulRuang, PERMUKAAN_LAYAR, permukaanLayarDari, proyektorKeLayar, type Ruang, silauLayar, tandaBentuk, templateRuang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { bersihkanAturProduk } from '../lib/tools-team';
import { bersihkanAturObjek } from '../lib/objek-saya';
import { AWAL_HALO, EKSPOSUR_MIN, eksposurLayar, gulungTerang, kuatHalo, PUTIH_LAYAR } from '../app/(portal)/tools-team/_components/desain3d/mesin/proyektorNyata';

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
cek(`ruang gelap: pantulan gambar sendiri ikut menerangi ruangan, eksposur ${(tGelap.e * 100).toFixed(0)}% (di atas batas ${EKSPOSUR_MIN}), rasio putih:hitam = kontras fisik ${gelap.kontras.toFixed(1)} : 1`,
  tGelap.e > EKSPOSUR_MIN && Math.abs(tGelap.putih / tGelap.hitam - gelap.kontras) < 1e-6);
cek('gambar redup (putih <= target) tidak mengubah ruangan; gulungan hanya di atas target', eksposurLayar(0.6) === 1 && gulungTerang(0.6) === 0.6 && gulungTerang(5) > PUTIH_LAYAR && gulungTerang(5) < 4);

console.log('\n3. BOM, produk & panel');
const bom = bomDesain([abu], []).find(r => r.item.startsWith('Layar'));
cek(`BOM layar mencatat permukaan & gain ("${bom?.catatan}")`, !!bom && /abu-abu/.test(bom.catatan) && /gain 0[.,]8/.test(bom.catatan));
const umumSrc = readFileSync('app/(portal)/tools-team/_components/desain3d/panel/benda/BagianUmum.tsx', 'utf8');
const potongTab = (tab: string) => umumSrc.split('<Bagian tab=').filter(x => x.startsWith(`"${tab}">`));
cek('detail ukuran produk ada di tab Produk; tab Posisi hanya posisi, tinggi & putar', potongTab('produk').some(x => /Ukuran produk/.test(x)) && !potongTab('posisi').some(x => /Ukuran produk/.test(x)));
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

console.log('\n4. Pantulan gambar ke ruangan & silau (5.000 vs 35.000 lm, ruang gelap)');
const rGelap: Ruang = { ...ruang, cahaya: 'gelap' };
const p5: Benda = { ...proyektor, lumen: 5000 }, p35: Benda = { ...proyektor, lumen: 35000 };
const k5 = kontrasProyektor(p5, [layar, p5], rGelap, 15), k35 = kontrasProyektor(p35, [layar, p35], rGelap, 15);
cek(`pantulan gambar ikut menerangi ruangan sebanding lumen (${k5.cahaya.layar.toFixed(0)} vs ${k35.cahaya.layar.toFixed(0)} lux)`, k5.cahaya.layar > 5 && Math.abs(k35.cahaya.layar / k5.cahaya.layar - 7) < 0.05);
cek(`kontras ruang gelap dibatasi pantulan sendiri: ${k5.kontras.toFixed(1)} : 1 vs ${k35.kontras.toFixed(1)} : 1, batas ${k35.batasPantul.toFixed(0)} : 1`,
  k35.kontras > k5.kontras && k35.kontras < k35.batasPantul && Math.abs(k35.batasPantul - k5.batasPantul) < 1e-9);
cek('target di atas batas pantulan: lumen berapa pun tidak cukup', k35.batasPantul < 50 && !Number.isFinite(kontrasProyektor(p35, [layar, p35], rGelap, 50).lumenPerlu));
cek(`silau: 5.000 lm ${k5.silau.tingkat} (${k5.silau.rasio.toFixed(1)}×), 35.000 lm ${k35.silau.tingkat} (${k35.silau.rasio.toFixed(1)}×)`, k5.silau.tingkat === 'terang' && k35.silau.tingkat === 'silau');
cek('ruang terang menaikkan batas nyaman: gambar yang sama lebih jarang silau', silauLayar(1000, 300, 1).rasio < silauLayar(1000, 5, 1).rasio && silauLayar(300, 5, 1).tingkat === 'nyaman');
cek(`halo silau di adegan 3D mulai di atas ${AWAL_HALO}× batas nyaman & makin kuat (${kuatHalo(k5.silau.rasio).toFixed(2)} vs ${kuatHalo(k35.silau.rasio).toFixed(2)})`,
  kuatHalo(1.5) === 0 && kuatHalo(k35.silau.rasio) > kuatHalo(k5.silau.rasio) && kuatHalo(1000) === 1);
cek('dinding abu-abu / gelap memantulkan lebih sedikit -> kontras naik', pantulRuang({}) === 0.45 && pantulRuang({ warnaDinding: '#374151' }) < 0.1
  && kontrasProyektor(p35, [layar, p35], { ...rGelap, warnaDinding: '#374151' }, 15).kontras > k35.kontras);
const nyataSrc = readFileSync(`${dir}mesin/proyektorNyata.ts`, 'utf8'), info = readFileSync(`${dir}panel/InfoProyektor.tsx`, 'utf8');
cek('adegan 3D: adaptasi mata parsial (akar pangkat tiga silau) & halo per proyektor', /eksposurLayar\(putih\) \* Math\.cbrt\(silau\)/.test(nyataSrc) && /kuatHalo\(u\.silau\)/.test(nyataSrc)
  && /silau: kp\.silau\.rasio/.test(sinarSrc) && /pusat: bg\.pusat/.test(sinarSrc));
cek('panel proyektor: status & peringatan silau, pantulan gambar di rincian cahaya, pesan batas pantulan, dimmer tidak menghitung pantulan', /Terlalu terang \/ silau/.test(info) && /pantulan gambar proyektor/.test(info)
  && /kp\.batasPantul <= targetKontras/.test(info) && /kp\.cahaya\.total - kp\.cahaya\.siang - kp\.cahaya\.layar/.test(info));

console.log('\n5. Ekspor: pilihan isi & objek yang disinari');
const ekspor = readFileSync(`${dir}ekspor/useEkspor.ts`, 'utf8'), menu = readFileSync(`${dir}panel/MenuEkspor.tsx`, 'utf8');
cek('Cetak / Lembar lengkap bisa tanpa Jadwal kabel & Rack elevation (sakelar tersimpan, bawaan ikut)', /const kabel = kabelCetak \? kabelLengkap\(\) : \[\];/.test(ekspor) && /rakCetak && benda\.some\(b => b\.jenis === 'rak'\)/.test(ekspor)
  && /useSakelarTersimpan\('wm_desain3d_kabel_cetak', true\)/.test(ekspor) && /useSakelarTersimpan\('wm_desain3d_rak_cetak', true\)/.test(ekspor) && /Jadwal kabel di Cetak/.test(menu) && /Rack elevation di Cetak/.test(menu));
const tLengkung = templateRuang('mapping-lengkung'), oLengkung = objekDisinari(tLengkung.benda, tLengkung.ruang);
cek(`mapping cekung: layar mapping disinari 3 proyektor, tertutup ${((oLengkung[0]?.tertutup ?? 0) * 100).toFixed(0)}%, area blending ${((oLengkung[0]?.tumpang ?? 0) * 100).toFixed(0)}%`,
  oLengkung.length === 1 && oLengkung[0].b.jenis === 'bidang' && oLengkung[0].proyektor.length === 3 && (oLengkung[0].tertutup ?? 0) > 0.95 && (oLengkung[0].tumpang ?? 0) > 0);
const luxSama = ['simulator', 'mapping-lengkung', 'mapping-cembung'].every(id => {
  const t = templateRuang(id as Parameters<typeof templateRuang>[0]);
  return t.benda.filter(x => x.jenis === 'proyektor').every(p => Math.abs(kontrasProyektor(p, t.benda, t.ruang, 15).luxGambar - (hasilPanasonic(p, t.benda, t.ruang).lux ?? -1)) < 1e-6);
});
cek('lux gambar di kontras, panel & ekspor = lux "Pusat" di label 3D (kubah simulator, layar cekung & cembung), bukan dinding di belakangnya', luxSama
  && /const g = gambarDiSasaran\(p, benda, ruang\), u = ukuranTampak\(p, g\.lebar, g\.tinggi\)/.test(ekspor) && /`\$\{fm\(g\.jarak\)\} m`, `\$\{fm\(u\.lebar\)\} × \$\{fm\(u\.tinggi\)\} m`/.test(ekspor));
const tObjek = templateRuang('mapping-objek'), kObjek = daftarRuang(tObjek.ruang)[0];
const kubus: Benda = { ...bendaBaru('objek', kObjek, { bentukObjek: 'kotak' }), nama: 'Kubus mapping', x: 6, z: 5, elev: 0.4, w: 1, h: 1, d: 1, rot: 0 };
const oObjek = objekDisinari([...tObjek.benda, kubus, { ...kubus, id: 'pojok', nama: 'Kubus pojok', x: 0.6, z: 0.6 }], tObjek.ruang);
cek(`objek mapping: tercatat penyinar & sisi terkena (${oObjek[0]?.sisi.join(', ')}); objek di luar sinar tidak ikut`,
  oObjek.length === 1 && oObjek[0].b.nama === 'Kubus mapping' && oObjek[0].proyektor.length === 3 && ['depan', 'atas'].every(x => oObjek[0].sisi.includes(x)));
cek('lembar ekspor punya tabel "Objek yang disinari proyektor" (jenis, ukuran, posisi, penyinar, cakupan)', /Objek yang disinari proyektor/.test(ekspor) && /'Disinari oleh', 'Cakupan sinar'/.test(ekspor));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
