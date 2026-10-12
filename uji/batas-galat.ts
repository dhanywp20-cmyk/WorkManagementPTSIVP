/**
 * uji/batas-galat.ts - batas galat (error boundary), 404, dan /api/health.
 *
 * Sebelum ini platform tidak punya error.tsx sama sekali: satu galat render menjatuhkan
 * seluruh halaman jadi layar putih. Uji ini menjaga supaya berkas-berkas itu tetap ada dan
 * /api/health tetap publik tanpa menyentuh basis data.
 *
 * Jalankan: npm test -- batas-galat
 */
import { existsSync, readFileSync } from 'fs';
import { galatBerkasTidakTermuat } from '../lib/galat-berkas';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Berkas batas galat ada');
for (const f of ['app/error.tsx', 'app/global-error.tsx', 'app/not-found.tsx', 'app/(portal)/error.tsx']) {
  cek(f, existsSync(f));
}
for (const f of ['app/error.tsx', 'app/global-error.tsx', 'app/(portal)/error.tsx']) {
  cek(`${f} adalah komponen klien`, /^'use client';/.test(readFileSync(f, 'utf8')));
}
cek('global-error membawa <html> & <body> sendiri', /<html[\s>]/.test(readFileSync('app/global-error.tsx', 'utf8')) && /<body[\s>]/.test(readFileSync('app/global-error.tsx', 'utf8')));

console.log('\n2. Galat berkas lama sesudah deploy dikenali');
cek('ChunkLoadError', galatBerkasTidakTermuat({ name: 'ChunkLoadError', message: 'Loading chunk 123 failed.' }));
cek('Loading chunk ... failed', galatBerkasTidakTermuat({ name: 'Error', message: 'Loading chunk app-pages-internals failed' }));
cek('dynamic import gagal (Chrome)', galatBerkasTidakTermuat({ message: 'Failed to fetch dynamically imported module: https://x/_next/a.js' }));
cek('dynamic import gagal (Safari)', galatBerkasTidakTermuat({ message: 'Importing a module script failed.' }));
cek('galat biasa TIDAK dianggap galat berkas', !galatBerkasTidakTermuat({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'map')" }));
cek('null aman', !galatBerkasTidakTermuat(null));

console.log('\n3. /api/health publik dan ringan');
const proxy = readFileSync('proxy.ts', 'utf8');
cek("'/api/health' ada di PUBLIC_EXACT", /PUBLIC_EXACT = \[[\s\S]*'\/api\/health'[\s\S]*\];/.test(proxy));
const health = readFileSync('app/api/health/route.ts', 'utf8');
cek('health tidak menyentuh basis data', !/supabase|getAdminClient|from\(/.test(health));
cek('health tidak di-cache', /no-store/.test(health));

console.log('\n4. Manifest tidak menunggu basis data di setiap permintaan');
const merek = readFileSync('lib/merek-server.ts', 'utf8');
cek('ada simpanan sementara', /simpanan/.test(merek) && /UMUR_SIMPAN_MS/.test(merek));
cek('hanya hasil berhasil yang disimpan (galat dilempar sebelum disimpan)', merek.indexOf('if (error) throw error') < merek.indexOf('simpanan = {'));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
