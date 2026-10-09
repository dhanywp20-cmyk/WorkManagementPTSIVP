/**
 * uji/desain3d-banyak.ts - pilih banyak benda Desain 3D & perangkat share nirkabel: toggle pilihan,
 * ikut geser/putar benda utama, skala, ukuran sama, rata tepi, duplikat; nirkabel = tanpa kabel,
 * tujuan share terdekat / pilihan, busur garis share.
 *
 * Jalankan: npx tsx uji/desain3d-banyak.ts
 */
import { bendaBaru, busurShare, duplikatBanyak, ikutUtama, jalurKabel, jalurShare, nirkabel, putarDi, rataBanyak, skalaBanyak, togglePilih, tujuanShare, ukuranBanyak, type Benda } from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const dekat = (a: number, b: number, t = 1e-6) => Math.abs(a - b) < t;
const k = { x0: 0, p: 8, l: 6, t: 3 };
const kotak = (id: string, x: number, z: number, w = 1, d = 1): Benda => ({ id, jenis: 'meja', nama: id, x, z, rot: 0, w, h: 0.75, d, elev: 0, bentukMeja: 'rapat' });

console.log('\nToggle pilihan');
cek('tanpa pilihan -> jadi utama', JSON.stringify(togglePilih(null, [], 'a')) === JSON.stringify({ pilih: 'a', lain: [] }));
cek('tambah & lepas benda lain', JSON.stringify(togglePilih('a', [], 'b')) === JSON.stringify({ pilih: 'a', lain: ['b'] }) && togglePilih('a', ['b'], 'b').lain.length === 0);
cek('lepas utama -> benda berikutnya jadi utama', JSON.stringify(togglePilih('a', ['b', 'c'], 'a')) === JSON.stringify({ pilih: 'b', lain: ['c'] }));

console.log('\nIkut benda utama');
const A = kotak('A', 2, 2), B = kotak('B', 3, 2), C = kotak('C', 5, 5);
const geser = ikutUtama([A, B, C], ['A', 'B'], A, { x: 2.5, z: 2.2, elev: 0, rot: 0 });
cek('B tergeser sejauh A (0,5 ; 0,2), C tidak terpilih diam', dekat(geser[1].x, 3.5) && dekat(geser[1].z, 2.2) && geser[2].x === 5);
const putar = ikutUtama([A, B], ['A', 'B'], A, { x: 2, z: 2, elev: 0, rot: 90 });
const [px, pz] = putarDi(3, 2, 2, 2, 90);
cek('putar 90°: B mengitari A & ikut berputar', dekat(putar[1].x, Math.round(px * 100) / 100) && dekat(putar[1].z, Math.round(pz * 100) / 100) && putar[1].rot === 90);
cek('putarDi 90° sesuai rotation.y three.js: (1,0) -> (0,-1)', dekat(putarDi(1, 0, 0, 0, 90)[0], 0) && dekat(putarDi(1, 0, 0, 0, 90)[1], -1));

console.log('\nUkuran & rata');
const s = skalaBanyak([A, B], ['B'], 2);
cek('skala 200% hanya benda terpilih', s[0].w === 1 && s[1].w === 2 && s[1].d === 2);
const tv = bendaBaru('tv', k, { diag: 55 });
cek('skala display mengikuti diagonal', skalaBanyak([tv], [tv.id], 1.2)[0].diag === 66);
cek('ukuran sama (lebar 1,5 m) untuk semua terpilih', ukuranBanyak([A, B], ['A', 'B'], { w: 1.5 }).every(b => b.w === 1.5));
const r = rataBanyak([kotak('P', 1, 1, 1), kotak('Q', 4, 3, 2)], ['P', 'Q'], 'kiri');
cek('rata kiri: tepi kiri semua = tepi terkiri (0,5)', dekat(r[0].x - 0.5, 0.5) && dekat(r[1].x - 1, 0.5));
const rb = rataBanyak([kotak('P', 1, 1, 1, 1), kotak('Q', 4, 3, 2, 2)], ['P', 'Q'], 'belakang');
cek('rata belakang (z terbesar): tepi = 4', dekat(rb[0].z + 0.5, 4) && dekat(rb[1].z + 1, 4));
const dup = duplikatBanyak([A, B], ['A', 'B'], 8);
cek('duplikat: 2 benda baru, id baru, geser 0,6 m', dup.benda.length === 4 && dup.baru.every(b => b.id !== 'A' && b.id !== 'B') && dekat(dup.baru[0].x, 2.6));

console.log('\nPerangkat & share nirkabel');
const vw = bendaBaru('videowall', k);
const led = { ...bendaBaru('led', k), x: 7.5, z: 3 };
const dongle = { ...bendaBaru('perangkat', k, { tipePerangkat: 'dongle' }), x: 2, z: 3 };
const pc = bendaBaru('perangkat', k, { tipePerangkat: 'pc' });
const laptop = bendaBaru('perangkat', k, { tipePerangkat: 'laptop' });
const laptopD = bendaBaru('perangkat', k, { tipePerangkat: 'laptop', pakaiDongle: true });
cek('dongle, HP, tablet & laptop + dongle = nirkabel; PC & laptop biasa tidak',
  nirkabel(dongle) && nirkabel(laptopD) && nirkabel(bendaBaru('perangkat', k, { tipePerangkat: 'hp' })) && !nirkabel(pc) && !nirkabel(laptop));
const semua = [vw, led, dongle, pc, laptopD, { ...bendaBaru('rak', k) }];
const sumberKabel = new Set(jalurKabel(semua, { p: 8, l: 6, t: 3, lantai: 'kayu' }, { power: true }).map(j => j.dari));
cek('perangkat nirkabel TANPA kabel; PC berkabel (dari = nama sumber)', !sumberKabel.has(dongle.nama) && !sumberKabel.has(laptopD.nama) && sumberKabel.has(pc.nama));
cek('tujuan bawaan = display terdekat (dongle di x 2 -> videowall)', tujuanShare(dongle, semua)?.id === vw.id);
cek('tujuan pilihan dipakai', tujuanShare({ ...dongle, layarTujuan: led.id }, semua)?.id === led.id);
cek('tujuan yang sudah dihapus -> kembali terdekat', tujuanShare({ ...dongle, layarTujuan: 'hilang' }, semua)?.id === vw.id);
cek('jalur share: hanya perangkat nirkabel', jalurShare(semua).length === 2);
const busur = busurShare([0, 1, 0], [4, 1, 0], 10);
cek('busur: mulai & berakhir di titiknya, puncak lebih tinggi', busur.length === 11 && dekat(busur[10][0], 4) && busur[5][1] > 1.3);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
