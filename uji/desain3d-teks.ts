/**
 * uji/desain3d-teks.ts - Teks / keterangan manual Desain 3D (inti/teks.ts): baris, ukuran kotak dari isi,
 * rebah di lantai, benda baru dari katalog, dan model dibangun ulang saat isinya berubah.
 *
 * Jalankan: npm test -- desain3d-teks
 */
import {
  barisTeks, bendaBaru, KATALOG, MAKS_BARIS_TEKS, tandaBentuk, terapkanUkuran, TINGGI_HURUF_MAKS, TINGGI_HURUF_MIN, ukuranTeks,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const K = { x0: 0, p: 8, l: 6, t: 3 };

console.log('\n1. Baris teks');
cek('kosong / spasi saja -> "Teks"', barisTeks('').join() === 'Teks' && barisTeks('   \n  ').join() === 'Teks');
cek('beberapa baris dipertahankan, baris kosong di akhir dibuang', barisTeks('Area tamu\nMaks 10 orang\n\n').length === 2);
cek(`maksimal ${MAKS_BARIS_TEKS} baris`, barisTeks(Array(20).fill('x').join('\n')).length === MAKS_BARIS_TEKS);
cek('CR (Windows) tidak ikut tergambar', !barisTeks('A\r\nB').some(s => s.includes('\r')));

console.log('\n2. Ukuran kotak dari isi');
const a = ukuranTeks('Rack', 0.1), b = ukuranTeks('Rack server utama', 0.1);
cek('teks lebih panjang = kotak lebih lebar', b.w > a.w);
cek('dua baris lebih tinggi dari satu baris', ukuranTeks('A\nB', 0.1).h > ukuranTeks('A', 0.1).h);
cek('huruf 2x lebih tinggi = kotak 2x lebih besar', Math.abs(ukuranTeks('Rack', 0.2).w - 2 * a.w) < 0.002);
cek('tinggi huruf di luar batas dijepit', ukuranTeks('A', 99).h <= ukuranTeks('A', TINGGI_HURUF_MAKS).h + 1e-9 && ukuranTeks('A', 0).h >= ukuranTeks('A', TINGGI_HURUF_MIN).h - 1e-9);
cek('emoji dihitung satu huruf (bukan dua unit UTF-16)', ukuranTeks('🔌', 0.1).w === ukuranTeks('A', 0.1).w);

console.log('\n3. Benda teks');
const dinding = bendaBaru('teks', K, { hadapTeks: 'berdiri' });
cek('teks dinding: tegak, tipis, setinggi mata', dinding.d === 0.01 && dinding.h > 0.1 && dinding.elev === 1.6);
const lantai = bendaBaru('teks', K, { hadapTeks: 'lantai' });
cek('teks lantai: kotak pipih, "dalam" = tinggi tulisan', lantai.h === 0.005 && lantai.d > 0.1 && lantai.elev < 0.01);
cek('label produk disembunyikan (tulisannya sendiri sudah label)', dinding.sembunyiLabel === true);
const ubah = terapkanUkuran({ ...dinding, teks: 'Jalur kabel lewat plafon' });
cek('ganti isi -> ukuran ikut', ubah.w > dinding.w);
cek('ganti isi -> model dibangun ulang (tandaBentuk berubah)', tandaBentuk(ubah) !== tandaBentuk(dinding));
cek('ganti warna latar -> model dibangun ulang', tandaBentuk({ ...dinding, latarTeks: '#ffffff' }) !== tandaBentuk(dinding));
cek('ada di katalog Tambah (3 arah)', KATALOG.flatMap(g => g.item).filter(i => i.jenis === 'teks').length === 3);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
