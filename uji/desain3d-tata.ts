/**
 * uji/desain3d-tata.ts - tata letak Desain 3D (inti/tata.ts): tapak ikut rotasi, ratakan & sebar, magnet,
 * larik, geser tepat, benda terkunci, dan kelompok sembunyikan.
 *
 * Jalankan: npm test -- desain3d-tata
 */
import {
  type Benda, bendaBaru, geserTepat, golonganDari, LABEL, larik, magnet, pusatkanIsi, ratakan, sebar, tampilDi, tapak, kunciSembunyi, jumlahSembunyiSendiri,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const K = { x0: 0, p: 8, l: 6, t: 3 };
const kursi = (id: string, x: number, z: number, extra: Partial<Benda> = {}): Benda => ({ ...bendaBaru('kursi', K), id, x, z, rot: 0, w: 0.5, d: 0.5, ...extra });
const dekat = (a: number, b: number) => Math.abs(a - b) < 1e-6;

console.log('\n1. Tapak');
const meja = { x: 4, z: 3, w: 2, d: 1, rot: 0 };
cek('tapak tanpa putar', dekat(tapak(meja).x0, 3) && dekat(tapak(meja).z1, 3.5));
cek('diputar 90°: lebar & dalam bertukar', dekat(tapak({ ...meja, rot: 90 }).x0, 3.5) && dekat(tapak({ ...meja, rot: 90 }).z0, 2));

console.log('\n2. Ratakan & sebar');
const tiga = [kursi('a', 1, 1), kursi('b', 2.3, 2), kursi('c', 5, 1.4)];
const kiri = ratakan(tiga, ['a', 'b', 'c'], 'x', 'awal');
cek('ratakan kiri: semua tepi kiri = tepi kiri terkiri', kiri.every(b => dekat(tapak(b).x0, 0.75)));
const depan = ratakan(tiga, ['a', 'b', 'c'], 'z', 'awal');
cek('ratakan depan: semua z sama', depan.every(b => dekat(b.z, 1)));
const sb = sebar(tiga, ['a', 'b', 'c'], 'x');
cek('sebar: ujung tetap, celah sama', dekat(sb[0].x, 1) && dekat(sb[2].x, 5) && dekat(sb[1].x, 3));
cek('sebar butuh minimal 3 benda', sebar(tiga.slice(0, 2), ['a', 'b'], 'x') === tiga.slice(0, 2) || sebar(tiga.slice(0, 2), ['a', 'b'], 'x').every((b, i) => b.x === tiga[i].x));
const kunci = [kursi('a', 1, 1), kursi('b', 2.3, 2, { terkunci: true })];
cek('benda terkunci tidak ikut diratakan', ratakan(kunci, ['a', 'b'], 'z', 'akhir')[1].z === 2);

console.log('\n3. Magnet');
const mejaB = { ...bendaBaru('meja', K), id: 'm', x: 4, z: 3, w: 2, d: 1, rot: 0 };
const k1 = kursi('k', 4.0, 3.78);   // tepi depan kursi 3,53 - 3 cm dari tepi belakang meja (3,5)
const t = magnet(k1, [mejaB]);
cek('kursi menempel ke tepi meja (z)', t.tarikZ && dekat(tapak({ ...k1, z: t.z }).z0, 3.5));
cek('sejajar tengah (x) ikut tertarik', t.tarikX && dekat(t.x, 4));
const jauh = magnet(kursi('k', 1, 1), [mejaB]);
cek('benda jauh tidak tertarik', !jauh.tarikX && !jauh.tarikZ && jauh.x === 1);

console.log('\n4. Larik & geser tepat');
const l = larik(kursi('k', 1, 1), 4, 3, 0.9, 1.2, { x: 8, z: 6 });
cek('4 × 3 = 11 salinan (asli di sel pertama)', l.length === 11);
cek('id unik & jarak tepat', new Set(l.map(b => b.id)).size === 11 && l.some(b => dekat(b.x, 3.7) && dekat(b.z, 3.4)));
cek('salinan di luar ruang dibuang', larik(kursi('k', 7, 1), 5, 1, 0.9, 1, { x: 8, z: 6 }).length === 1);
const g = geserTepat([kursi('a', 1, 1), kursi('b', 2, 2, { terkunci: true })], ['a', 'b'], 'x', 1.2, { x: 8, z: 6 });
cek('geser tepat 1.200 mm; yang terkunci diam', dekat(g[0].x, 2.2) && g[1].x === 2);
cek('geser tepat dijepit di dalam ruang', geserTepat([kursi('a', 7.5, 1)], ['a'], 'x', 3, { x: 8, z: 6 })[0].x === 8);

console.log('\n5. Kelompok & pusatkan');
cek('semua jenis punya kelompok', (Object.keys(LABEL) as Benda['jenis'][]).every(j => !!golonganDari(j)));
cek('sembunyikan audio: speaker tersembunyi, kursi tetap', !tampilDi({ id: 's', jenis: 'speaker' }, ['audio']) && tampilDi({ id: 'k', jenis: 'kursi' }, ['audio']));
cek('sembunyikan satu benda: hanya benda itu', !tampilDi({ id: 'k1', jenis: 'kursi' }, [kunciSembunyi('k1')]) && tampilDi({ id: 'k2', jenis: 'kursi' }, [kunciSembunyi('k1')]));
cek('hitung sembunyi satu per satu (bukan kelompok)', jumlahSembunyiSendiri(['audio', kunciSembunyi('a'), kunciSembunyi('b')]) === 2);
const isi = [kursi('a', 1, 1), kursi('b', 1.6, 1, { terkunci: true })];
const pusat = pusatkanIsi(isi, { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null }, 'xz');
cek('pusatkan isi: benda terkunci tetap di tempat', pusat.find(b => b.id === 'b')!.x === 1.6 && pusat.find(b => b.id === 'a')!.x !== 1);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
