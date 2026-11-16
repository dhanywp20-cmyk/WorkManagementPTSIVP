import { readFileSync } from 'fs';
import { ALAT_FILE, MAKS_BYTE_FILE, MAKS_NAMA_FILE, periksaFile } from '../lib/tools-file';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

console.log('\n1. Isian berkas diperiksa');
const ok = periksaFile({ alat: 'av-layar', nama: '  Ruang\u0007 rapat  lt.3 ', data: { 'layar.jarak': 8 }, ringkasan: 'a'.repeat(999) });
cek('isian sah diterima & nama dirapikan', ok.ok && ok.nama === 'Ruang rapat lt.3' && ok.alat === 'av-layar');
cek('ringkasan dipotong 300', ok.ok && ok.ringkasan.length === 300);
cek('alat asing ditolak', !periksaFile({ alat: 'led', nama: 'x', data: {} }).ok && !periksaFile({ alat: '../x', nama: 'x', data: {} }).ok);
cek('nama kosong ditolak', !periksaFile({ alat: 'cekbarang', nama: '   ', data: {} }).ok);
cek('nama dipotong', (r => r.ok && r.nama.length === MAKS_NAMA_FILE)(periksaFile({ alat: 'cekbarang', nama: 'n'.repeat(500), data: {} })));
cek('data bukan objek ditolak', !periksaFile({ alat: 'banding', nama: 'x', data: [1] }).ok && !periksaFile({ alat: 'banding', nama: 'x', data: 'x' }).ok);
cek('data terlalu besar ditolak', !periksaFile({ alat: 'banding', nama: 'x', data: { t: 'x'.repeat(MAKS_BYTE_FILE) } }).ok);
cek('body bukan objek ditolak', !periksaFile(null).ok && !periksaFile([]).ok);

console.log('\n2. Migration & route');
const sql = readFileSync('supabase/migrations/077_tools_file.sql', 'utf8');
cek('tabel tools_file + RLS aktif', sql.includes('create table if not exists public.tools_file') && sql.includes('alter table public.tools_file enable row level security'));
cek('pola alat di SQL menerima semua ALAT_FILE', ALAT_FILE.every(a => /^[a-z][a-z0-9-]{1,39}$/.test(a)));
const rute = readFileSync('app/api/tools-team/file/route.ts', 'utf8');
cek('ubah hanya untuk alat yang sama', rute.includes("lama.alat !== cek.alat"));
cek('pimpinan hanya lihat (POST & DELETE)', rute.split('await pimpinanDiDb(').length === 3);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
