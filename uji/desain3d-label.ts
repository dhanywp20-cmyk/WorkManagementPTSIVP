/**
 * uji/desain3d-label.ts - Penempatan label produk bergaris penunjuk (mesin/labelProduk.ts pilihTempatLabel):
 * tidak menutupi benda sendiri / benda lain / label lain, arah pilihan, jarak terdekat dulu.
 *
 * Jalankan: npm test -- desain3d-label
 */
import { type KotakLayar, pilihTempatLabel } from '../app/(portal)/tools-team/_components/desain3d/mesin/labelProduk';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const W = 80, H = 14;
const kotak = (ax: number, ay: number, t: { dx: number; dy: number }): KotakLayar => ({ l: ax + t.dx - W / 2, r: ax + t.dx + W / 2, t: ay + t.dy - H / 2, b: ay + t.dy + H / 2 });
const tumpang = (a: KotakLayar, b: KotakLayar) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

console.log('\n1. Ruang kosong');
const atas = pilihTempatLabel(200, 200, W, H, -1, [], [])!;
cek('di atas titik bila diminta di atas', atas.dx === 0 && atas.dy < 0);
const bawah = pilihTempatLabel(200, 200, W, H, 1, [], [])!;
cek('di bawah titik untuk benda plafon', bawah.dx === 0 && bawah.dy > 0);
cek('jarak terdekat dipakai (garis pendek)', Math.abs(atas.dy) - H / 2 <= 15);

console.log('\n2. Menghindari benda');
const sendiri: KotakLayar = { l: 150, r: 250, t: 200, b: 300 };          // titik di tepi atas benda
const diAtas: KotakLayar = { l: 120, r: 280, t: 120, b: 199 };           // benda lain tepat di atasnya
const t1 = pilihTempatLabel(200, 200, W, H, -1, [sendiri, diAtas], [])!;
cek('tidak menutupi benda sendiri', !tumpang(kotak(200, 200, t1), sendiri));
cek('tidak menutupi benda lain', !tumpang(kotak(200, 200, t1), diAtas));

console.log('\n3. Menghindari label lain');
const lain = kotak(200, 200, atas);
const t2 = pilihTempatLabel(200, 200, W, H, -1, [], [lain])!;
cek('label kedua tidak menumpuk label pertama', !!t2 && !tumpang(kotak(200, 200, t2), lain));
const penuh: KotakLayar[] = [{ l: 0, r: 1000, t: 0, b: 1000 }];
cek('semua tempat tertutup label -> disembunyikan (null)', pilihTempatLabel(200, 200, W, H, -1, [], penuh) === null);
cek('semua tempat tertutup benda -> tetap tampil (tumpang paling kecil)', pilihTempatLabel(200, 200, W, H, -1, penuh, []) !== null);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
