/**
 * uji/tujuan-lanjut.ts - ?lanjut= setelah login hanya boleh jalur internal (bukan open redirect).
 *
 * Jalankan: npx tsx uji/tujuan-lanjut.ts
 */
import { tujuanLanjutAman } from '../lib/tujuan-lanjut';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nTujuan setelah login');
cek('jalur modul diterima', tujuanLanjutAman('/ticketing') === '/ticketing');
cek('query & hash ikut', tujuanLanjutAman('/ticketing?open=abc#x') === '/ticketing?open=abc#x');
cek('kosong / null -> null', tujuanLanjutAman('') === null && tujuanLanjutAman(null) === null);
cek('//situs-lain ditolak', tujuanLanjutAman('//evil.example/x') === null);
cek('/\\situs-lain ditolak', tujuanLanjutAman('/\\evil.example') === null);
cek('URL penuh ditolak', tujuanLanjutAman('https://evil.example/') === null);
cek('javascript: ditolak', tujuanLanjutAman('javascript:alert(1)') === null);
cek('/api & /_next ditolak', tujuanLanjutAman('/api/auth/logout') === null && tujuanLanjutAman('/_next/x') === null);
cek('karakter kendali ditolak', tujuanLanjutAman('/tick\neting') === null);
cek('/dashboard sendiri -> null (sudah di sana)', tujuanLanjutAman('/dashboard') === null);
cek('jalur relatif ../ dinormalkan tetap internal', tujuanLanjutAman('/a/../ticketing') === '/ticketing');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
