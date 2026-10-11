/**
 * uji/desain3d-teks.ts - Teks / keterangan manual Desain 3D (inti/teks.ts): baris, ukuran kotak dari isi,
 * rebah di lantai, benda baru dari katalog, model dibangun ulang saat isinya berubah, dan teks baru
 * ditempatkan di tempat yang tidak tertutup benda lain (inti/tempatTeks.ts).
 *
 * Jalankan: npm test -- desain3d-teks
 */
import {
  barisTeks, bendaBaru, KATALOG, MAKS_BARIS_TEKS, tandaBentuk, terapkanUkuran, TINGGI_HURUF_MAKS, TINGGI_HURUF_MIN, ukuranTeks,
  tempatTeksBebas, type Benda,
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

console.log('\n5. Teks baru tidak tertutup benda');
const ruang5 = { x0: 0, p: 5, l: 6, t: 3 };
const vw: Benda = { id: 'vw', jenis: 'videowall', nama: 'Videowall', x: 2.5, z: 0.06, w: 2.43, h: 1.37, d: 0.1, elev: 1.02, rot: 0 };
const tDinding = terapkanUkuran(bendaBaru('teks', ruang5, { hadapTeks: 'berdiri' }));
const posD = tempatTeksBebas(tDinding, [vw], ruang5);
cek('dinding kosong -> tetap di tengah', tempatTeksBebas(tDinding, [], ruang5).x === tDinding.x);
cek('ada videowall di tengah -> digeser ke samping, tidak menumpuk', Math.abs(posD.x - 2.5) >= 2.43 / 2 + tDinding.w / 2 && posD.elev === tDinding.elev);
cek('tetap di dalam ruangan', posD.x - tDinding.w / 2 >= 0 && posD.x + tDinding.w / 2 <= 5);
const kredensa: Benda = { id: 'kr', jenis: 'meja', nama: 'Kredensa', x: 2.5, z: 0.3, w: 1.8, h: 0.8, d: 0.45, elev: 0, rot: 0 };
cek('benda rendah di depan dinding tidak dianggap menutupi', tempatTeksBebas(tDinding, [kredensa], ruang5).x === tDinding.x);
const penuh: Benda = { ...vw, id: 'penuh', w: 4.9, h: 1, elev: 1.2 };
const posP = tempatTeksBebas(tDinding, [penuh], ruang5);
cek('dinding penuh -> naik di atas benda dinding', posP.elev >= 2.2 && posP.elev + tDinding.h <= 3);
const tLantai = terapkanUkuran(bendaBaru('teks', ruang5, { hadapTeks: 'lantai' }));
const meja: Benda = { id: 'mj', jenis: 'meja', nama: 'Meja rapat', x: 2.5, z: 3, w: 1.2, h: 0.75, d: 3.2, elev: 0, rot: 0 };
const posL = tempatTeksBebas(tLantai, [meja], ruang5);
const kenaMeja = Math.abs(posL.x - 2.5) < (1.2 + tLantai.w) / 2 && Math.abs(posL.z - 3) < (3.2 + tLantai.d) / 2;
cek('teks lantai tidak di bawah meja', !kenaMeja);
cek('speaker plafon tidak menutupi teks lantai', tempatTeksBebas(tLantai, [{ ...meja, id: 'sp', jenis: 'speaker-plafon', elev: 2.9, h: 0.1 }], ruang5).x === tLantai.x);
const tMelayang = terapkanUkuran(bendaBaru('teks', ruang5, { hadapTeks: 'kamera' }));
cek('teks melayang tidak dipindah', tempatTeksBebas(tMelayang, [meja, vw], ruang5).x === tMelayang.x);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
