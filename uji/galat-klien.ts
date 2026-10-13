/**
 * uji/galat-klien.ts - pencatatan galat di layar pengguna (Admin Panel -> Kesehatan Sistem).
 *
 * Jalankan: npm test -- galat-klien
 */
import { readFileSync } from 'fs';
import { abaikanGalat, rapikanLaporan, BATAS_PESAN } from '../lib/galat-klien';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const ASAL = 'https://work-management-ptsivp.vercel.app';

console.log('\n1. Kebisingan dibuang');
cek('"Script error." (pihak ketiga)', abaikanGalat('Script error.'));
cek('ResizeObserver loop', abaikanGalat('ResizeObserver loop completed with undelivered notifications.'));
cek('permintaan dibatalkan', abaikanGalat('AbortError: The user aborted a request.'));
cek('berkas lama sesudah deploy', abaikanGalat('ChunkLoadError: Loading chunk 77 failed.'));
cek('ekstensi peramban', abaikanGalat('x is undefined', 'chrome-extension://abc/content.js', ASAL));
cek('skrip domain lain', abaikanGalat('boom', 'https://cdn.lain.com/a.js', ASAL));
cek('galat platform TIDAK dibuang', !abaikanGalat("TypeError: Cannot read properties of undefined (reading 'map')", `${ASAL}/_next/static/chunks/a.js`, ASAL));
cek('pesan kosong dibuang', abaikanGalat('   '));

console.log('\n2. Laporan dirapikan');
const r = rapikanLaporan({ pesan: 'a'.repeat(500), jalur: '/ticketing/5f9c2b1e-1234-4abc-9def-0123456789ab?open=x', sumber: 'halaman' });
cek('pesan dipotong', r.pesan.length === BATAS_PESAN);
cek('id & query dibuang dari jalur (satu galat = satu baris)', r.jalur === '/ticketing/:id');
cek('sumber tak dikenal jatuh ke "halaman"', rapikanLaporan({ pesan: 'x', sumber: 'aneh' as never }).sumber === 'halaman');

console.log('\n3. Penyambungan');
const proxy = readFileSync('proxy.ts', 'utf8');
cek('/api/galat publik (galat bisa di layar login)', /'\/api\/galat'/.test(proxy));
const route = readFileSync('app/api/galat/route.ts', 'utf8');
cek('route membatasi ukuran badan', /teks\.length > 4096/.test(route));
cek('route membatasi jenis per hari', /BATAS_JENIS_PER_HARI/.test(route));
cek('route membersihkan catatan > 30 hari', /30 \* 86_400_000/.test(route));
cek('LayarGalat melapor', /laporGalat\(/.test(readFileSync('components/shared/LayarGalat.tsx', 'utf8')));
cek('PelaporGalat dipasang di layout', /<PelaporGalat \/>/.test(readFileSync('app/layout.tsx', 'utf8')));
const sql = readFileSync('supabase/migrations/048_galat_klien.sql', 'utf8');
cek('tabel tanpa akses peramban', /REVOKE ALL ON public\.galat_klien FROM PUBLIC, anon, authenticated/.test(sql));
cek('galat sama = jumlah+1, bukan baris baru', /ON CONFLICT \(sidik\) DO UPDATE SET jumlah = public\.galat_klien\.jumlah \+ 1/.test(sql));
cek('halaman / dialihkan server', /redirect\('\/dashboard'\)/.test(readFileSync('app/page.tsx', 'utf8')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
