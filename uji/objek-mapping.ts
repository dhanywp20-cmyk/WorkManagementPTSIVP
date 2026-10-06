/**
 * uji/objek-mapping.ts - objek mapping Desain 3D (Tools Team): siluet "Objek dari gambar"
 * (topeng latar, tepi luar & lubang, penyederhanaan, validasi), aturan impor berkas 3D
 * (format utama, satuan, posisi tegak), dan geometri tiap bentuk objek.
 *
 * Jalankan: npx tsx uji/objek-mapping.ts
 */
import {
  adaTransparansi, buatTopeng, bersihkanTopeng, konturDariPiksel, konturSah, luasPoligon, sederhanakan, telusuriTepi, warnaTepi,
} from '../app/tools-team/_components/desain3d/impor/kontur';
import { formatUtama, tebakSatuan, ukuranModel } from '../app/tools-team/_components/desain3d/impor/berkas3d';
import { buatModel } from '../app/tools-team/_components/desain3d/bangun';
import { bendaBaru, tandaBentuk, tinggiAlasDi, LABEL_BENTUK_OBJEK, type Benda, type BentukObjek } from '../app/tools-team/_components/desain3d/inti';
import * as THREE from 'three';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const dekat = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

/** Gambar RGBA w x h, latar `latar`, lalu `isi(x, y)` -> warna piksel objek atau null. */
function gambar(w: number, h: number, latar: [number, number, number, number], isi: (x: number, y: number) => [number, number, number, number] | null) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = isi(x, y) ?? latar, i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3];
  }
  return d;
}
const PUTIH: [number, number, number, number] = [255, 255, 255, 255];
const HITAM: [number, number, number, number] = [20, 20, 20, 255];
const KOSONG: [number, number, number, number] = [0, 0, 0, 0];
/** Luas kontur ternormalisasi (semua bagian, lubang dikurangi). */
const luasKontur = (k: { l: number[]; h?: number[][] }[]) => k.reduce((s, b) => s + Math.abs(luasPoligon(b.l)) - (b.h ?? []).reduce((t, h) => t + Math.abs(luasPoligon(h)), 0), 0);

console.log('Topeng & warna latar');
{
  const g = gambar(40, 30, PUTIH, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 25 ? HITAM : null));
  cek('warna tepi = putih', warnaTepi(g, 40, 30).join() === '255,255,255');
  cek('tanpa transparansi', !adaTransparansi(g, 40, 30));
  const { topeng, mode } = buatTopeng(g, 40, 30, { latar: 'otomatis', toleransi: 20 });
  cek('otomatis -> warna', mode === 'warna');
  cek('luas topeng = 400 piksel', topeng.reduce((s, v) => s + v, 0) === 400);
  const t = gambar(40, 30, KOSONG, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 25 ? HITAM : null));
  cek('PNG transparan terdeteksi', adaTransparansi(t, 40, 30));
  cek('otomatis -> transparan', buatTopeng(t, 40, 30, { latar: 'otomatis', toleransi: 20 }).mode === 'transparan');
  cek('utuh = semua piksel', buatTopeng(g, 40, 30, { latar: 'utuh', toleransi: 20 }).topeng.every(v => v === 1));
}

console.log('Isi banjir dari tepi: bagian putih di dalam objek tetap objek');
{
  //  Persegi hitam 20x20 dengan "jendela" putih 6x6 di tengah (tidak tersambung ke tepi).
  const g = gambar(40, 40, PUTIH, (x, y) => {
    if (!(x >= 10 && x < 30 && y >= 10 && y < 30)) return null;
    return x >= 17 && x < 23 && y >= 17 && y < 23 ? PUTIH : HITAM;
  });
  const a = konturDariPiksel(g, 40, 40, { latar: 'warna', toleransi: 20 })!;
  cek('satu bagian tanpa lubang (jendela ikut objek)', a.kontur.length === 1 && !a.kontur[0].h);
  const b = konturDariPiksel(g, 40, 40, { latar: 'warna', toleransi: 20, lubangLatar: true })!;
  cek('lubangLatar: jendela jadi lubang', b.kontur.length === 1 && b.kontur[0].h?.length === 1);
  cek('luas = 1 - 36/400', dekat(luasKontur(b.kontur), 1 - 36 / 400, 0.005), String(luasKontur(b.kontur)));
}

console.log('Persegi -> 4 titik, ternormalisasi ke kotak batas');
{
  const g = gambar(50, 40, PUTIH, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 35 ? HITAM : null));
  const r = konturDariPiksel(g, 50, 40, { latar: 'otomatis', toleransi: 25 })!;
  cek('terdeteksi', !!r);
  cek('kotak batas 10..30 x 5..35', r.kotak.x0 === 10 && r.kotak.x1 === 30 && r.kotak.y0 === 5 && r.kotak.y1 === 35, JSON.stringify(r.kotak));
  cek('satu bagian, 4 titik', r.kontur.length === 1 && r.kontur[0].l.length === 8, JSON.stringify(r.kontur));
  const xs = r.kontur[0].l.filter((_, i) => i % 2 === 0), ys = r.kontur[0].l.filter((_, i) => i % 2 === 1);
  cek('x mencakup 0..1', Math.min(...xs) === 0 && Math.max(...xs) === 1);
  cek('y mencakup 0..1', Math.min(...ys) === 0 && Math.max(...ys) === 1);
  cek('luas penuh = 1', dekat(luasKontur(r.kontur), 1, 1e-6));
}

console.log('Cincin transparan -> tepi luar + 1 lubang');
{
  const W = 120, c = 60;
  const g = gambar(W, W, KOSONG, (x, y) => { const r = Math.hypot(x + 0.5 - c, y + 0.5 - c); return r <= 50 && r >= 25 ? HITAM : null; });
  const r = konturDariPiksel(g, W, W, { latar: 'otomatis', toleransi: 20 })!;
  cek('mode transparan', r.mode === 'transparan');
  cek('1 bagian + 1 lubang', r.kontur.length === 1 && r.kontur[0].h?.length === 1);
  const harap = (Math.PI * (50 * 50 - 25 * 25)) / (100 * 100);
  cek('luas cincin ≈ π(R²-r²)', dekat(luasKontur(r.kontur), harap, 0.03), `${luasKontur(r.kontur).toFixed(3)} vs ${harap.toFixed(3)}`);
  cek('lingkaran disederhanakan (< 200 titik)', r.titik < 200, String(r.titik));
  cek('kontur sah', konturSah(r.kontur) !== null);
}

console.log('Dua objek terpisah & bintik noda');
{
  const g = gambar(80, 40, PUTIH, (x, y) => {
    if (x >= 5 && x < 30 && y >= 5 && y < 35) return HITAM;
    if (x >= 45 && x < 75 && y >= 10 && y < 30) return HITAM;
    if (x === 38 && y === 2) return HITAM;  // bintik 1 piksel
    return null;
  });
  const r = konturDariPiksel(g, 80, 40, { latar: 'warna', toleransi: 20 })!;
  cek('2 bagian (bintik dibuang)', r.kontur.length === 2, String(r.kontur.length));
  cek('kotak batas tidak termasuk bintik', r.kotak.y0 === 5, JSON.stringify(r.kotak));
}

console.log('Lubang kecil ditutup, piksel bersinggungan sudut tetap valid');
{
  const w = 30, h = 30;
  const t = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) t[y * w + x] = 1;
  t[15 * w + 15] = 0;  // lubang 1 piksel
  const b = bersihkanTopeng(t, w, h);
  cek('lubang 1 piksel ditutup', b[15 * w + 15] === 1);
  //  Dua piksel bersinggungan sudut (pelana).
  const s = new Uint8Array(4 * 4); s[1 * 4 + 1] = 1; s[2 * 4 + 2] = 1;
  const p = telusuriTepi(s, 4, 4);
  cek('pelana: 2 poligon terpisah', p.length === 2 && p.every(q => dekat(Math.abs(luasPoligon(q)), 1, 1e-9)), JSON.stringify(p));
}

console.log('Penyederhanaan & validasi');
{
  const lingkar: number[] = [];
  for (let i = 0; i < 360; i++) { const a = (i * Math.PI) / 180; lingkar.push(100 + 50 * Math.cos(a), 100 + 50 * Math.sin(a)); }
  const s = sederhanakan(lingkar, 0.5);
  cek('lingkaran 360 -> < 60 titik', s.length / 2 < 60, String(s.length / 2));
  cek('luas tetap ±2%', dekat(luasPoligon(s) / luasPoligon(lingkar), 1, 0.02));
  cek('kontur kosong ditolak', konturSah([]) === null);
  cek('angka di luar 0..1 ditolak', konturSah([{ l: [0, 0, 2, 0, 1, 1] }]) === null);
  cek('bukan angka ditolak', konturSah([{ l: [0, 0, 'x', 0, 1, 1] }]) === null);
  cek('lubang rusak ditolak', konturSah([{ l: [0, 0, 1, 0, 1, 1], h: [[0.1, 0.1]] }]) === null);
  cek('kontur kecil sah', konturSah([{ l: [0, 0, 1, 0, 1, 1] }]) !== null);
  const g = gambar(20, 20, PUTIH, () => null);
  cek('gambar polos -> tidak ada objek', konturDariPiksel(g, 20, 20, { latar: 'warna', toleransi: 20 }) === null);
}

console.log('Impor berkas 3D: format utama, satuan, posisi tegak');
{
  cek('glb diutamakan dari tekstur', formatUtama(['tekstur.jpg', 'patung.glb'])?.format === 'glb');
  cek('obj + mtl -> obj', formatUtama(['gedung.mtl', 'gedung.obj', 'a.png'])?.indeks === 1);
  cek('dae SketchUp dikenali (huruf besar)', formatUtama(['Tugu.DAE'])?.format === 'dae');
  cek('fbx diutamakan dari obj', formatUtama(['a.obj', 'a.fbx'])?.format === 'fbx');
  cek('skp saja -> tidak ada format', formatUtama(['rumah.skp']) === null);
  cek('tekstur saja -> tidak ada format', formatUtama(['a.jpg', 'b.png']) === null);
  cek('ratusan -> mm', tebakSatuan(1800, 'stl') === 'mm');
  cek('fbx puluhan -> cm', tebakSatuan(45, 'fbx') === 'cm');
  cek('obj puluhan -> m (gedung)', tebakSatuan(45, 'obj') === 'm');
  cek('kecil -> m', tebakSatuan(2.4, 'obj') === 'm');
  const u = ukuranModel([1200, 600, 2400], 'mm', 90);
  cek('mm + tegakkan: tinggi = sumbu z berkas', u.w === 1.2 && u.h === 2.4 && u.d === 0.6, JSON.stringify(u));
  const v = ukuranModel([10, 20, 5], 'inci', 0);
  cek('inci, tanpa putar', dekat(v.w, 0.254, 1e-3) && dekat(v.h, 0.508, 1e-3) && dekat(v.d, 0.127, 1e-3), JSON.stringify(v));
  const w180 = ukuranModel([1, 2, 3], 'm', 180);
  cek('balik 180 tidak menukar sumbu', w180.h === 2 && w180.d === 3);
}

console.log('Geometri objek mapping: kotak batas = w × h × d, alas di lantai');
{
  const K = { x0: 0, p: 8, l: 6, t: 3 };
  const bahan = { THREE, layar: () => null, model: () => null };
  const kotakDari = (b: Benda) => new THREE.Box3().setFromObject(buatModel(b, bahan));
  for (const bentuk of Object.keys(LABEL_BENTUK_OBJEK) as BentukObjek[]) {
    const b0 = bendaBaru('objek', K, { bentukObjek: bentuk });
    const b = bentuk === 'gambar'
      ? { ...b0, kontur: [{ l: [0, 0, 1, 0, 1, 1, 0.5, 0.6, 0, 1], h: [[0.2, 0.2, 0.4, 0.2, 0.4, 0.4]] }], w: 1.5, h: 3, d: 0.4 }
      : { ...b0, w: 1.3, h: 2.1, d: 0.7 };
    const k = kotakDari(b), s = k.getSize(new THREE.Vector3());
    cek(`${bentuk}: ukuran ${b.w} × ${b.h} × ${b.d}`, dekat(s.x, b.w, 0.01) && dekat(s.y, b.h, 0.01) && dekat(s.z, b.d, 0.01),
      `${s.x.toFixed(3)} × ${s.y.toFixed(3)} × ${s.z.toFixed(3)}`);
    cek(`${bentuk}: alas di y = 0`, dekat(k.min.y, 0, 1e-6), String(k.min.y));
  }
  const g = bendaBaru('objek', K, { bentukObjek: 'gambar' });
  cek('gambar tanpa kontur -> kotak pengganti', dekat(kotakDari(g).getSize(new THREE.Vector3()).y, g.h, 0.01));
  const a = { ...g, kontur: [{ l: [0, 0, 1, 0, 0.5, 1] }] }, b2 = { ...g, kontur: [{ l: [0, 0, 1, 0, 0.6, 1] }] };
  cek('kontur berubah -> model dibangun ulang', tandaBentuk(a) !== tandaBentuk(b2));
  cek('bentuk berubah -> dibangun ulang', tandaBentuk({ ...g, bentukObjek: 'kotak' }) !== tandaBentuk({ ...g, bentukObjek: 'bola' }));
  //  Model impor ditegakkan: kotak berkas 2 (x) × 1 (y) × 4 (z, atas) -> tegak 4 m.
  const isi = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4));
  const m = { ...bendaBaru('model', K), w: 2, h: 4, d: 1, putarModel: 90, modelKunci: 'x' };
  const km = new THREE.Box3().setFromObject(buatModel(m, { THREE, layar: () => null, model: () => isi })).getSize(new THREE.Vector3());
  cek('model Z-up ditegakkan: tinggi 4 m', dekat(km.y, 4, 0.01) && dekat(km.z, 1, 0.01), `${km.x} × ${km.y} × ${km.z}`);
  cek('model asli di memori tidak ikut diputar', isi.rotation.x === 0);
}

console.log('Objek baru berdiri di atas alas');
{
  const K = { x0: 0, p: 12, l: 10, t: 5 };
  const alas = { ...bendaBaru('panggung', K), x: 6, z: 5, w: 1.8, d: 1.8, h: 0.4, rot: 0 };
  cek('di atas alas: elev = tinggi alas', tinggiAlasDi([alas], 6, 5) === 0.4);
  cek('di luar alas: lantai', tinggiAlasDi([alas], 8, 5) === 0);
  const miring = { ...alas, w: 4, d: 0.5, rot: 90 };
  cek('alas diputar 90°: tapak ikut berputar', tinggiAlasDi([miring], 6, 6.5) === 0.4 && tinggiAlasDi([miring], 7.5, 5) === 0);
  const meja = { ...bendaBaru('meja', K), x: 6, z: 5 };
  cek('alas tertinggi yang dipakai (meja di atas panggung)', tinggiAlasDi([alas, { ...meja, elev: 0.4 }], 6, 5) === Math.round((0.4 + meja.h) * 1000) / 1000);
  cek('benda sendiri dikecualikan', tinggiAlasDi([alas], 6, 5, alas.id) === 0);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
