/**
 * uji/desain3d-ruang-gerak.ts - Cek ruang gerak (inti/ruangGerak.ts): benda bertumpuk, menembus dinding /
 * plafon, ayunan pintu, jarak meja rapat ke dinding, servis depan rack, jarak ke dinding; template pabrik bersih.
 *
 * Jalankan: npm test -- desain3d-ruang-gerak
 */
import {
  type Benda, cekRuangGerak, jarakKeDinding, KATEGORI_RUANG, type Ruang, templateRuang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const ruang: Ruang = { p: 6, l: 6, t: 3, lantai: 'kayu', r2: null };
const b = (x: Partial<Benda> & Pick<Benda, 'id' | 'jenis'>): Benda => ({ nama: x.id, x: 3, z: 3, w: 1, h: 1, d: 1, elev: 0, rot: 0, ...x });
const kode = (bs: Benda[], r: Ruang = ruang) => cekRuangGerak(bs, r).map(c => c.kode);

console.log('\n1. Jarak ke dinding');
const j = jarakKeDinding(b({ id: 'a', jenis: 'objek', x: 1, z: 2, w: 1, d: 0.5 }), { x0: 0, p: 6, l: 6, t: 3 });
cek('kiri 0,5 · kanan 4,5 · depan 1,75 · belakang 3,75', j.kiri === 0.5 && j.kanan === 4.5 && j.depan === 1.75 && j.belakang === 3.75);

console.log('\n2. Bertumpuk');
cek('dua kotak di tempat yang sama -> tumpang', kode([b({ id: 'a', jenis: 'objek' }), b({ id: 'c', jenis: 'objek', x: 3.4 })]).includes('tumpang'));
cek('bersebelahan (menempel) -> aman', !kode([b({ id: 'a', jenis: 'objek' }), b({ id: 'c', jenis: 'objek', x: 4 })]).includes('tumpang'));
cek('benda di atas meja (beda tinggi) -> aman', !kode([b({ id: 'm', jenis: 'meja', bentukMeja: 'kelas', h: 0.75 }), b({ id: 'p', jenis: 'perangkat', elev: 0.75, h: 0.02, w: 0.3, d: 0.2 })]).includes('tumpang'));
cek('kursi di bawah meja -> wajar', !kode([b({ id: 'm', jenis: 'meja', bentukMeja: 'kelas', w: 1.2, d: 0.5 }), b({ id: 'k', jenis: 'kursi', z: 3.3, w: 0.5, d: 0.5 })]).includes('tumpang'));
cek('kotak diputar 45° di sudut kotak lain (AABB bersentuhan, bentuk tidak) -> aman',
  !kode([b({ id: 'a', jenis: 'objek' }), b({ id: 'c', jenis: 'objek', x: 4.15, z: 4.15, rot: 45 })]).includes('tumpang'));

console.log('\n3. Dinding & plafon');
cek('keluar dinding kanan', cekRuangGerak([b({ id: 'a', jenis: 'objek', x: 5.8 })], ruang).some(c => c.kode === 'keluar' && c.pesan.includes('kanan')));
cek('menembus plafon', kode([b({ id: 'a', jenis: 'objek', h: 3.5 })]).includes('plafon'));
cek('teks tidak dicek', kode([b({ id: 't', jenis: 'teks', x: 7 })]).length === 0);
const dua: Ruang = { ...ruang, r2: { aktif: true, p: 4, l: 6, t: 3, lantai: 'kayu', pintu: false, sekat: 'terbuka' } };
cek('sekat terbuka: boleh menyeberang ke ruang sebelah', !kode([b({ id: 'a', jenis: 'objek', x: 5.9, w: 1 })], dua).includes('keluar'));
cek('sekat tembok: menyeberang = menembus', kode([b({ id: 'a', jenis: 'objek', x: 5.9, w: 1 })], { ...dua, r2: { ...dua.r2!, sekat: 'tembok' } }).includes('keluar'));

console.log('\n4. Pintu, meja, rack');
const pintu: Ruang = { ...ruang, bukaan: [{ id: 'p', ruang: 0, sisi: 'belakang', jenis: 'pintu', posisi: 1, lebar: 0.9, tinggi: 2.1, ambang: 0 }] };
cek('benda di area ayun pintu -> terhalang', kode([b({ id: 'r', jenis: 'objek', x: 5, z: 5.6, w: 0.6, d: 0.6 })], pintu).includes('pintu'));
cek('speaker dinding di atas pintu -> aman', !kode([b({ id: 's', jenis: 'speaker', x: 5, z: 5.9, w: 0.3, d: 0.2, elev: 2.3, h: 0.4 })], pintu).includes('pintu'));
cek('meja rapat 60 cm dari dinding -> sempit', kode([b({ id: 'm', jenis: 'meja', bentukMeja: 'rapat', x: 1.1, w: 1, d: 3, h: 0.75 })]).includes('meja'));
cek('meja rapat lega -> aman', !kode([b({ id: 'm', jenis: 'meja', bentukMeja: 'rapat', w: 1.2, d: 3, h: 0.75 })]).includes('meja'));
cek('rack menghadap dinding dekat -> servis kurang', kode([b({ id: 'r', jenis: 'rak', x: 3, z: 5.4, w: 0.6, d: 0.8, h: 1.2, rot: 0 })]).includes('rak'));
cek('rack menghadap ruang -> aman', !kode([b({ id: 'r', jenis: 'rak', x: 3, z: 0.45, w: 0.6, d: 0.8, h: 1.2, rot: 0 })]).includes('rak'));
cek('kursi di depan rack bukan penghalang', !kode([b({ id: 'r', jenis: 'rak', x: 3, z: 0.45, w: 0.6, d: 0.8, h: 1.2 }), b({ id: 'k', jenis: 'kursi', x: 3, z: 1.2, w: 0.5, d: 0.5 })]).includes('rak'));

console.log('\n5. Template pabrik tanpa catatan');
for (const k of KATEGORI_RUANG) {
  const t = templateRuang(k.id), c = cekRuangGerak(t.benda, t.ruang);
  cek(`${k.id}${c.length ? ` (${c.map(x => x.pesan).join('; ')})` : ''}`, c.length === 0);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
