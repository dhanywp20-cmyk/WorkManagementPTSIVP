/**
 * uji/ekspor-tabel.ts - ekspor daftar bersama (Excel & cetak): susunan baris Excel (judul, filter
 * aktif, kepala, data), lebar kolom, lembar cetak (rata kanan angka, kertas mendatar bila kolom banyak).
 *
 * Jalankan: npx tsx uji/ekspor-tabel.ts
 */
import { filterAktif, lebarKolom, lembarTabel, susunAoa } from '../lib/ekspor-tabel';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface R { p: string; n: number | null; c?: string }
const e = {
  judul: 'Aktivitas Harian', menu: 'Daily Report',
  kolom: [{ judul: 'Project', ambil: (r: R) => r.p }, { judul: 'Nilai', ambil: (r: R) => r.n, angka: true }, { judul: 'Catatan', ambil: (r: R) => r.c }],
  baris: [{ p: '  Gedung   A ', n: 4 }, { p: 'B', n: null, c: 'baris\nbaru' }] as R[],
  filter: [['Status', 'Selesai'], ['Teknisi', ''], ['Divisi', null]] as [string, string | null][],
};

console.log('\nSusunan Excel');
const { aoa, kepala } = susunAoa(e, '9 Oktober 2026');
cek('judul, info jumlah & tanggal di atas', aoa[0][0] === 'Aktivitas Harian' && String(aoa[1][0]).includes('2 baris') && String(aoa[1][0]).includes('9 Oktober 2026'));
cek('hanya filter yang terisi yang dicatat', aoa[2][0] === 'Filter: Status = Selesai');
cek('kepala tepat di indeks yang dilaporkan', sama(aoa[kepala], ['Project', 'Nilai', 'Catatan']));
cek('spasi & ganti baris dirapikan, kosong = "", angka tetap angka', sama(aoa[kepala + 1], ['Gedung A', 4, '']) && sama(aoa[kepala + 2], ['B', '', 'baris baru']));
const tanpaFilter = susunAoa({ ...e, filter: [] }, 'x');
cek('tanpa filter tidak ada baris filter', tanpaFilter.kepala === 3);

console.log('\nLebar kolom');
const lebar = lebarKolom(aoa, kepala, 3);
cek('minimal 8, ikut isi terpanjang', lebar[0] === 10 && lebar[1] === 8);
cek('maksimal 60', lebarKolom([['x'.repeat(200)]], 0, 1)[0] === 60);

console.log('\nLembar cetak');
const l = lembarTabel(e);
const seksi = l.seksi[0] as { jenis: string; isi: string[][]; rataKanan?: number[] };
cek('kolom angka rata kanan, isi berupa teks', sama(seksi.rataKanan, [1]) && seksi.isi[0][1] === '4');
cek('filter aktif di kepala lembar', sama(l.kepala, [['Status', 'Selesai']]));
cek('3 kolom = tegak; 7 kolom = mendatar', !l.mendatar && !!lembarTabel({ ...e, kolom: Array(7).fill(e.kolom[0]) }).mendatar);
cek('filterAktif membuang null/kosong/spasi', filterAktif([['a', ' '], ['b', 0], ['c', 'x']]).length === 2);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
