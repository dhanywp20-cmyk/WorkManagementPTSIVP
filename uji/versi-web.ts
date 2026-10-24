/**
 * uji/versi-web.ts - kapan halaman yang lama terbuka memeriksa versi web & kapan ajakan muat ulang muncul
 * (lib/versi-web.ts). Latar: aplikasi Android menjalankan kode web lama berhari-hari - perbaikan sesi 400 hari
 * tidak sampai ke HP.
 *
 * Jalankan: npx tsx uji/versi-web.ts
 */
import { readFileSync } from 'fs';
import { adaVersiBaru, JEDA_PERIKSA_MS, perluPeriksa } from '../lib/versi-web';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nKapan memeriksa');
cek('belum pernah tersembunyi -> tidak memeriksa', !perluPeriksa(null, 1e9));
cek('tersembunyi 2 menit -> tidak memeriksa (hemat permintaan)', !perluPeriksa(1e9, 1e9 + 2 * 60_000));
cek('tersembunyi tepat 10 menit -> memeriksa', perluPeriksa(1e9, 1e9 + JEDA_PERIKSA_MS));
cek('tersembunyi semalaman -> memeriksa', perluPeriksa(1e9, 1e9 + 12 * 3600_000));

console.log('\nKapan ajakan muat ulang muncul');
cek('komit sama -> tidak', !adaVersiBaru('dbf93ed', 'dbf93ed'));
cek('komit berbeda -> ya', adaVersiBaru('245c93b', 'dbf93ed'));
cek('lokal tanpa komit -> tidak pernah', !adaVersiBaru('', 'dbf93ed') && !adaVersiBaru('dbf93ed', null));

console.log('\nTerpasang di tempat yang benar');
const tata = readFileSync('app/layout.tsx', 'utf8');
cek('PantauVersiWeb dipasang di layout akar (semua halaman, termasuk aplikasi Android)', /<PantauVersiWeb \/>/.test(tata));
const kesehatan = readFileSync('app/api/health/route.ts', 'utf8');
cek('/api/health melaporkan komit & tetap tanpa basis data', /komit:/.test(kesehatan) && !/supabase/i.test(kesehatan.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
const aktivitas = readFileSync('android/app/src/main/java/id/ptsivp/workmanagement/MainActivity.java', 'utf8');
cek('APK mengabari halaman (wm-kembali) saat dibuka kembali dari latar belakang', /dispatchEvent\(new Event\('wm-kembali'\)\)/.test(aktivitas) && /keLatarSejak = System\.currentTimeMillis\(\)/.test(aktivitas));
const versi = readFileSync('android/version.properties', 'utf8');
cek('versi APK dinaikkan (versionCode 4, 1.0.3)', /versionCode=4/.test(versi) && /versionName=1\.0\.3/.test(versi));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
