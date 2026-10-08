/**
 * uji/daftar-pilihan.ts - daftar pilihan dropdown yang diatur Admin: bawaan = isi lama kode,
 * kerapian (kembar, kosong, panjang), nilai terkunci, simpan hanya yang berubah, data lama tetap tampil.
 *
 * Jalankan: npx tsx uji/daftar-pilihan.ts
 */
import { bacaDaftarPilihan, bawaanSemua, DAFTAR_PILIHAN, defDaftar, denganNilai, MAKS_PANJANG, produkSpesifik, rapikanDaftar, ringkasDaftarPilihan } from '../lib/daftar-pilihan-bawaan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nBawaan');
cek('belum diatur (null / teks rusak / {}) -> semua bawaan', sama(bacaDaftarPilihan(null), bawaanSemua()) && sama(bacaDaftarPilihan('{rusak'), bawaanSemua()) && sama(bacaDaftarPilihan({}), bawaanSemua()));
cek('bawaan merek display = daftar lama kode (9 merek, Microvision pertama)', defDaftar('merek-display').bawaan.length === 9 && defDaftar('merek-display').bawaan[0] === 'Microvision');
cek('terkunci selalu bagian dari bawaannya', DAFTAR_PILIHAN.every(d => (d.terkunci ?? []).every(t => d.bawaan.includes(t))));

console.log('\nKerapian');
const ev = defDaftar('unit-event');
cek('spasi dirapikan, kosong & kembar (beda huruf) dibuang, urutan dipertahankan', sama(rapikanDaftar(['  Demo  ', '', 'demo', 'Service', 5], ev), ['Demo', 'Service']));
cek('nilai dipotong ke batas panjang', rapikanDaftar(['x'.repeat(200)], ev)[0].length === MAKS_PANJANG);
cek('daftar kosong ditolak -> bawaan (dropdown tidak pernah kosong)', sama(rapikanDaftar([], ev), ev.bawaan) && sama(rapikanDaftar('bukan daftar', ev), ev.bawaan));

console.log('\nTerkunci');
const kg = defDaftar('piket-kegiatan');
cek('"Demo Product" & "RnD" dikembalikan bila dihapus', sama(rapikanDaftar(['Maintenance', 'Workshop'], kg), ['Demo Product', 'RnD', 'Maintenance', 'Workshop']));
cek('tidak digandakan bila sudah ada (beda huruf)', sama(rapikanDaftar(['rnd', 'Demo Product', 'Workshop'], kg), ['rnd', 'Demo Product', 'Workshop']));

console.log('\nSimpan & baca');
const ubah = { ...bawaanSemua(), 'unit-event': [...ev.bawaan, 'Pameran'] };
const ringkas = ringkasDaftarPilihan(ubah);
cek('hanya daftar yang berubah yang ditulis', sama(Object.keys(ringkas), ['unit-event']));
const balik = bacaDaftarPilihan(JSON.stringify(ringkas));
cek('dibaca ulang: yang diubah ikut, lainnya bawaan', balik['unit-event'].includes('Pameran') && sama(balik['merek-display'], defDaftar('merek-display').bawaan));

console.log('\nData lama & All Product');
cek('nilai lama yang sudah dihapus tetap tampil di belakang', sama(denganNilai(['A', 'B'], 'b', 'Lama', null, ['C', 'a']), ['A', 'B', 'Lama', 'C']));
cek('daftar tidak berubah bila nilainya sudah ada', denganNilai(['A'], 'A').length === 1);
cek('produk spesifik = tanpa "All Product"', sama(produkSpesifik(['All Product', 'LED', 'IFP']), ['LED', 'IFP']));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
