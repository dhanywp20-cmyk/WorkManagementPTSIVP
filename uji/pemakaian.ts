/**
 * uji/pemakaian.ts - catatan pemakaian menu (lib/pemakaian.ts): daftar modul yang diterima server
 * sama persis dengan rute portal, saringan sub, pengelompokan akun, dan ringkasan tab Pemakaian.
 *
 * Jalankan: npx tsx uji/pemakaian.ts
 */
import { readdirSync, statSync } from 'node:fs';
import { MODUL_DICATAT, kelompokAkun, modulSah, ringkasPemakaian, subSah, type AkunPemakaian, type BarisPemakaian } from '../lib/pemakaian';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nDaftar modul = rute portal');
const rute = readdirSync('app/(portal)').filter(f => !f.startsWith('_') && statSync(`app/(portal)/${f}`).isDirectory()).sort();
cek('MODUL_DICATAT sama dengan folder app/(portal)', [...MODUL_DICATAT].sort().join() === rute.join());

console.log('\nSaringan');
cek('modul dikenal diterima', modulSah('ticketing') && modulSah('tools-team'));
cek('modul asing / bukan string ditolak', !modulSah('admin') && !modulSah('') && !modulSah(1) && !modulSah("ticketing' or 1=1"));
cek('sub alat diterima hanya untuk tools-team', subSah('tools-team', '3d') && !subSah('ticketing', '3d'));
cek('sub asing ditolak', !subSah('tools-team', 'hapus') && !subSah('tools-team', 3));
cek('tanpa sub selalu diterima', subSah('ticketing', null) && subSah('tools-team', undefined) && subSah('dashboard', ''));

console.log('\nKelompok akun');
cek('admin', kelompokAkun({ role: 'admin', team_type: 'Team PTS IVP' }) === 'admin');
cek('team', kelompokAkun({ role: 'team', team_type: 'Team PTS IVP' }) === 'team');
cek('guest di Team PTS Daerah tetap Team Product', kelompokAkun({ role: 'guest', team_type: 'Team PTS Daerah' }) === 'team');
cek('marketing', kelompokAkun({ role: 'guest', team_type: 'Marketing' }) === 'marketing');
cek('sales / guest lain', kelompokAkun({ role: 'guest', team_type: 'Guest' }) === 'lain' && kelompokAkun(undefined) === 'lain');

console.log('\nRingkasan');
const akun: AkunPemakaian[] = [
  { id: 'a', full_name: 'Ani', username: 'ani', role: 'team', team_type: 'Team PTS IVP' },
  { id: 'b', full_name: 'Budi', username: 'budi', role: 'guest', team_type: 'Marketing' },
  { id: 'c', full_name: 'Citra', username: 'citra', role: 'guest', team_type: 'Guest' },
];
const b = (user_id: string, modul: string, sub: string | null, created_at: string): BarisPemakaian => ({ user_id, modul, sub, created_at });
const r = ringkasPemakaian([
  b('a', 'tools-team', '3d', '2026-10-01T01:00:00Z'),
  b('a', 'tools-team', 'led', '2026-10-02T01:00:00Z'),
  b('b', 'tools-team', '3d', '2026-10-03T01:00:00Z'),
  b('a', 'ticketing', null, '2026-10-01T02:00:00Z'),
  b('x', 'ticketing', null, '2026-10-04T02:00:00Z'),
], akun);
const tools = r.modul.find(m => m.modul === 'tools-team')!;
cek('pengguna unik & kunjungan per modul', tools.pengguna === 2 && tools.kunjungan === 3);
cek('rincian per kelompok', tools.perKelompok.team === 1 && tools.perKelompok.marketing === 1 && tools.perKelompok.lain === 0);
cek('waktu terakhir = paling baru', tools.terakhir === '2026-10-03T01:00:00Z');
cek('urut dari pengguna terbanyak', r.modul[0].pengguna >= r.modul[r.modul.length - 1].pengguna);
cek('alat: Desain 3D 2 pengguna, LED 1, lainnya 0', r.alat.find(a => a.sub === '3d')!.pengguna === 2 && r.alat.find(a => a.sub === 'led')!.pengguna === 1 && r.alat.find(a => a.sub === 'av')!.kunjungan === 0);
cek('modul yang tidak dibuka terdaftar', r.tidakDibuka.includes('daily-report') && !r.tidakDibuka.includes('ticketing'));
cek('jangkauan: Sales 0 dari 1 akun (akun terhapus tidak dihitung)', r.jangkauan.lain.total === 1 && r.jangkauan.lain.aktif === 0 && r.jangkauan.team.aktif === 1 && r.jangkauan.marketing.aktif === 1);
cek('akun terhapus tetap tampil dengan label', r.teraktif.some(u => u.nama === 'Akun terhapus'));
cek('akun teraktif pertama = Ani (3×)', r.teraktif[0].nama === 'Ani' && r.teraktif[0].kunjungan === 3 && r.teraktif[0].modul === 2);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
