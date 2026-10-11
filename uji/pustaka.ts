/**
 * uji/pustaka.ts - registri Pustaka Tools Team: validasi entri, dan isi awal migrasi 040 harus lolos
 * validasi yang sama dengan server (kalau tidak, admin tidak bisa menyimpan ulang entri bawaan).
 *
 * Jalankan: npx tsx uji/pustaka.ts
 */
import { readFileSync } from 'node:fs';
import { bolehLihatPustaka, bolehUbahEntri, JENIS_PUSTAKA, KUNCI_MENU_PUSTAKA, periksaEntri, tapPertama } from '../lib/pustaka';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nValidasi entri');
const ok = periksaEntri('proyektor', ' Laser X ', { lumen: '6000', throwMin: 1.2, throwMaks: '1,9', resolusi: 'WUXGA', asing: 'buang' });
cek('angka teks (koma) diterima, bidang asing dibuang, nama dirapikan',
  ok.ok && ok.nama === 'Laser X' && ok.data.lumen === 6000 && ok.data.throwMaks === 1.9 && !('asing' in ok.data));
cek('bidang wajib kosong ditolak', !periksaEntri('proyektor', 'X', { lumen: 5000, throwMin: 1 }).ok);
cek('angka di luar rentang ditolak', !periksaEntri('material-akustik', 'X', { a: 3 }).ok);
cek('pilihan tidak sah ditolak', !periksaEntri('perangkat-poe', 'X', { watt: 10, kelas: 'poe9' }).ok);
cek('jenis tak dikenal & nama kosong ditolak', !periksaEntri('rahasia', 'X', {}).ok && !periksaEntri('artikel', '  ', { kategori: 'umum', isi: 'a' }).ok);
const tap = (t: string) => tapPertama({ id: '', jenis: 'speaker', nama: '', data: { tap: t } });
cek('tap pertama: "3/6/12" = 3, "7,5/15/30" = 7,5 (koma desimal), kosong = 0', tap('3/6/12') === 3 && tap('7,5/15/30') === 7.5 && tap('') === 0);

console.log('\nRegistri');
cek('kode jenis unik & sah untuk kolom DB', new Set(JENIS_PUSTAKA.map(j => j.v)).size === JENIS_PUSTAKA.length && JENIS_PUSTAKA.every(j => /^[a-z][a-z-]{1,39}$/.test(j.v)));
cek('tiap bidang pilih punya opsi', JENIS_PUSTAKA.every(j => j.bidang.every(b => b.tipe !== 'pilih' || (b.opsi?.length ?? 0) > 0)));

console.log('\nIsi awal migrasi 040');
const sql = readFileSync('supabase/migrations/040_pustaka_tools_team.sql', 'utf8');
const baris = [...sql.matchAll(/^ {2}\('([a-z-]+)', '((?:[^']|'')*)', '((?:[^']|'')*)', 'Bawaan'\)/gm)];
const salah = baris.map(m => ({ j: m[1], n: m[2].replace(/''/g, "'"), h: periksaEntri(m[1], m[2].replace(/''/g, "'"), JSON.parse(m[3].replace(/''/g, "'"))) }))
  .filter(x => !x.h.ok);
cek(`${baris.length} entri awal lolos validasi registri${salah.length ? ` (gagal: ${salah.map(s => `${s.j}/${s.n}: ${(s.h as { alasan: string }).alasan}`).join('; ')})` : ''}`, baris.length >= 40 && salah.length === 0);
cek('setiap jenis punya isi awal', JENIS_PUSTAKA.every(j => baris.some(m => m[1] === j.v)));

console.log('\nIzin melihat Pustaka');
cek('Admin, superadmin & Team selalu boleh', ['admin', 'superadmin', 'team', 'team_pts'].every(role => bolehLihatPustaka({ role })));
cek('pimpinan boleh walau role guest', bolehLihatPustaka({ role: 'guest', pimpinan: true }));
cek('Marketing / Sales tanpa izin ditolak', !bolehLihatPustaka({ role: 'guest', allowed_menus: ['tools-team', 'dashboard'] }) && !bolehLihatPustaka({ role: 'guest' }));
cek('Marketing / Sales dengan izin tools-pustaka boleh', bolehLihatPustaka({ role: 'guest', allowed_menus: ['tools-team', KUNCI_MENU_PUSTAKA] }));
cek('tanpa akun ditolak', !bolehLihatPustaka(null));

console.log('\nSiapa boleh ubah / hapus satu entri');
const SAYA = 'a1b2c3d4-0000-4000-8000-000000000001', ORANG = 'a1b2c3d4-0000-4000-8000-000000000002';
cek('Team: entri buatan sendiri boleh', bolehUbahEntri({ id: SAYA, admin: false }, SAYA));
cek('Team: entri buatan orang lain TIDAK boleh', !bolehUbahEntri({ id: SAYA, admin: false }, ORANG));
cek('Team: isi awal migrasi (dibuat_oleh kosong) TIDAK boleh', !bolehUbahEntri({ id: SAYA, admin: false }, null) && !bolehUbahEntri({ id: SAYA, admin: false }, undefined));
cek('Admin: semua entri boleh, termasuk isi awal', bolehUbahEntri({ id: SAYA, admin: true }, ORANG) && bolehUbahEntri({ id: SAYA, admin: true }, null));
cek('id kosong tidak cocok dengan dibuat_oleh kosong', !bolehUbahEntri({ id: '', admin: false }, ''));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
