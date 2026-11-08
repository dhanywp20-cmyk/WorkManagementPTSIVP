import { readFileSync } from 'node:fs';
import { berkasMasuk, bersihkanSql, buangMenuPemilik, cariRahasia, rapikanPaket } from '../scripts/master/inti.mjs';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

console.log('\nIsi paket');
cek('kode aplikasi ikut', berkasMasuk('app/(portal)/layout.tsx') && berkasMasuk('lib/lisensi/inti.ts') && berkasMasuk('vercel.json') && berkasMasuk('.env.example'));
cek('berkas internal pemilik tidak ikut', !berkasMasuk('docs/BACKUP-DB.md') && !berkasMasuk('sql/cek-rls.sql') && !berkasMasuk('.github/workflows/ci.yml') && !berkasMasuk('scripts/lisensi/terbitkan.ts') && !berkasMasuk('scripts/terbitkan-apk.mjs') && berkasMasuk('scripts/master/buat-admin.mjs'));
cek('berkas .env asli tidak ikut', !berkasMasuk('.env') && !berkasMasuk('.env.local') && !berkasMasuk('sub/.env.production'));

console.log('\nMenu Database PTS');
const menu = buangMenuPemilik(readFileSync('app/(portal)/_kerangka/daftar-menu.tsx', 'utf8'));
cek('menu & tautan OneDrive pemilik hilang', !menu.includes('Database PTS') && !menu.includes('1drv.ms/f/') && !menu.includes('database-pts'));
cek('menu lain utuh', menu.includes("key: 'unit-movement'") && menu.includes("key: 'daily-report'") && /INTERNAL_DAILY_KEYS = \['picket-showroom', 'daily-report', 'unit-movement'\]/.test(menu));

console.log('\npackage.json');
const paket = JSON.parse(rapikanPaket(readFileSync('package.json', 'utf8')));
cek('skrip uji internal dibuang, skrip buat-admin ditambah', !paket.scripts.test && paket.scripts['buat-admin'] === 'node scripts/master/buat-admin.mjs' && paket.scripts.build === 'next build');

console.log('\nSkema SQL');
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstu';
const sql = bersihkanSql(`\\restrict abc\nSET transaction_timeout = 0;\nCREATE SCHEMA public;\nselect net.http_post('https://abcdefghijklmnopqrst.supabase.co/x', headers := '{"Authorization":"Bearer ${jwt}"}');\n\\unrestrict abc\n`);
cek('kunci JWT & URL project diganti placeholder', !sql.includes(jwt) && sql.includes('<GANTI_SERVICE_ROLE_KEY>') && sql.includes('https://<GANTI_PROJECT_REF>.supabase.co'));
cek('baris khusus pg_dump 17 dibuang, schema public aman dijalankan ulang', !sql.includes('\\restrict') && !sql.includes('transaction_timeout') && sql.includes('CREATE SCHEMA IF NOT EXISTS public;'));
cek('pemindai menemukan rahasia yang tersisa', cariRahasia(`x ${jwt}`).length === 1 && cariRahasia('-----BEGIN PRIVATE KEY-----').length === 1 && cariRahasia('aman').length === 0);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
