/**
 * uji/desain3d-label.ts - Penempatan label produk (mesin/labelProduk.ts pilihTempatLabel): menempel di tepi
 * benda (jarak terdekat), arah pilihan, digeser sedikit bila menumpuk label lain.
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

console.log('\n1. Arah');
const atas = pilihTempatLabel(200, 200, W, H, -1, [], [])!;
cek('di atas titik bila diminta di atas', atas.dx === 0 && atas.dy < 0);
const bawah = pilihTempatLabel(200, 200, W, H, 1, [], [])!;
cek('di bawah titik untuk benda plafon', bawah.dx === 0 && bawah.dy > 0);

console.log('\n2. Menempel di tepi benda');
cek('jarak pil ke titik benda hanya 3 px (terasa menempel)', Math.abs(atas.dy) - H / 2 === 3);

console.log('\n3. Menghindari label lain');
const lain = kotak(200, 200, atas);
const t2 = pilihTempatLabel(200, 200, W, H, -1, [], [lain]);
cek('label kedua tidak menumpuk label pertama', !!t2 && !tumpang(kotak(200, 200, t2), lain));
cek('geseran tetap dekat (≤ 18 px dari titik)', !!t2 && Math.min(Math.abs(t2.dx) - W / 2, Math.abs(t2.dy) - H / 2) <= 18);
const penuh: KotakLayar[] = [{ l: 0, r: 1000, t: 0, b: 1000 }];
cek('semua tempat tertutup label -> disembunyikan (null)', pilihTempatLabel(200, 200, W, H, -1, [], penuh) === null);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
