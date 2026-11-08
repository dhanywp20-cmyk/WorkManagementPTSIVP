import { readFileSync } from 'node:fs';
import { berkasMasuk, bersihkanSql, buangKunciPemilik, buangMenuPemilik, cariRahasia, rapikanPaket } from '../scripts/master/inti.mjs';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

console.log('\nIsi paket');
cek('kode aplikasi ikut', berkasMasuk('app/(portal)/layout.tsx') && berkasMasuk('lib/lisensi/inti.ts') && berkasMasuk('vercel.json') && berkasMasuk('.env.example'));
cek('berkas internal pemilik tidak ikut', !berkasMasuk('docs/BACKUP-DB.md') && !berkasMasuk('sql/cek-rls.sql') && !berkasMasuk('.github/workflows/ci.yml') && !berkasMasuk('scripts/lisensi/terbitkan.ts') && !berkasMasuk('scripts/terbitkan-apk.mjs') && !berkasMasuk('scripts/pemilik/buat-file-lokal.mjs') && berkasMasuk('scripts/master/buat-admin.mjs'));
cek('berkas .env asli tidak ikut', !berkasMasuk('.env') && !berkasMasuk('.env.local') && !berkasMasuk('sub/.env.production'));

console.log('\nMenu Database PTS');
const menu = buangMenuPemilik(readFileSync('app/(portal)/_kerangka/daftar-menu.tsx', 'utf8'));
cek('menu & tautan OneDrive pemilik hilang', !menu.includes('Database PTS') && !menu.includes('1drv.ms/f/') && !menu.includes('database-pts'));
cek('menu lain utuh', menu.includes("key: 'unit-movement'") && menu.includes("key: 'daily-report'") && /INTERNAL_DAILY_KEYS = \['picket-showroom', 'daily-report', 'unit-movement'\]/.test(menu));

console.log('\nData demo');
const demo = readFileSync('scripts/master/demo/05-data-demo.sql', 'utf8');
const hapusDemo = readFileSync('scripts/master/demo/06-hapus-data-demo.sql', 'utf8');
cek('data demo fiktif: tanpa menu Database, password di-hash bcrypt, bisa dihapus', !demo.includes('database-pts') && /extensions\.crypt\('Demo#2026', extensions\.gen_salt\('bf', 12\)\)/.test(demo) && /DELETE FROM public\.users/.test(hapusDemo));
cek('semua id demo memakai awalan yang dihapus 06-hapus-data-demo', (demo.match(/'[0-9a-f]{8}-[0-9a-f]{4}-4000-8000-[0-9a-f]{12}'/g) || []).every(x => x.startsWith("'d0000000-0000-4000-8000-")));

const daftarKunci = buangKunciPemilik("export const A = [\n  'daily-report',\n  'database-pts',\n  'unit-movement',\n];\nconst B = { 'daily-report': 'X',\n  'database-pts': { label: 'Database PTS', icon: 'x' },\n};\nconst C = ['tech-note', 'unit-movement', 'database-pts',\n];\n");
cek('pilihan menu Database PTS dibuang dari kode lain (User Management, nav)', !daftarKunci.includes('database-pts') && daftarKunci.includes("'unit-movement',\n];") && daftarKunci.includes("'daily-report': 'X',\n};"));

console.log('\npackage.json');
const paket = JSON.parse(rapikanPaket(readFileSync('package.json', 'utf8')));
cek('skrip uji internal dibuang, skrip buat-admin ditambah', !paket.scripts.test && paket.scripts['buat-admin'] === 'node scripts/master/buat-admin.mjs' && paket.scripts.build === 'next build');

console.log('\nSkema SQL');
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstu';
const sql = bersihkanSql(`\\restrict abc\nSET transaction_timeout = 0;\nCREATE SCHEMA public;\nselect net.http_post('https://abcdefghijklmnopqrst.supabase.co/x', headers := '{"Authorization":"Bearer ${jwt}"}');\n\\unrestrict abc\n`);
cek('kunci JWT & URL project diganti placeholder', !sql.includes(jwt) && sql.includes('<GANTI_SERVICE_ROLE_KEY>') && sql.includes('https://<GANTI_PROJECT_REF>.supabase.co'));
cek('baris khusus pg_dump 17 dibuang, schema public aman dijalankan ulang', !sql.includes('\\restrict') && !sql.includes('transaction_timeout') && sql.includes('CREATE SCHEMA IF NOT EXISTS public;'));
cek('menu database-pts dibuang dari nilai bawaan allowed_menus', bersihkanSql("allowed_menus text[] DEFAULT ARRAY['form-bast'::text, 'database-pts'::text, 'unit-movement'::text]") === "allowed_menus text[] DEFAULT ARRAY['form-bast'::text, 'unit-movement'::text]");
cek('pemindai menemukan rahasia yang tersisa', cariRahasia(`x ${jwt}`).length === 1 && cariRahasia('-----BEGIN PRIVATE KEY-----').length === 1 && cariRahasia('aman').length === 0);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
