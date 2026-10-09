/**
 * uji/sertifikat.ts - sertifikat Learning Center: hanya untuk attempt lulus & bernilai final,
 * nomor tetap per attempt (tanggal WIB), tanggal Indonesia, ringkas judul.
 *
 * Jalankan: npx tsx uji/sertifikat.ts
 */
import { bolehSertifikat, nomorSertifikat, ringkasJudul, tanggalSertifikat } from '../lib/sertifikat';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const dasar = { id: 'a1b2c3d4-0000-0000-0000-000000000000', passed: true, is_submitted: true, score: 85, submitted_at: '2026-10-09T03:00:00Z', grading_status: 'auto' as const };

console.log('\nBerhak');
cek('lulus & final -> berhak', bolehSertifikat(dasar));
cek('tidak lulus / belum dikirim / essay menunggu / tanpa nilai -> tidak', !bolehSertifikat({ ...dasar, passed: false }) && !bolehSertifikat({ ...dasar, is_submitted: false })
  && !bolehSertifikat({ ...dasar, grading_status: 'pending_review' }) && !bolehSertifikat({ ...dasar, score: null }) && !bolehSertifikat(null));
cek('essay sudah dinilai & lulus -> berhak', bolehSertifikat({ ...dasar, grading_status: 'graded' }));

console.log('\nNomor & tanggal');
cek('nomor LC-YYYYMMDD-XXXXXX', nomorSertifikat(dasar) === 'LC-20261009-A1B2C3');
cek('tanggal mengikuti WIB (20:00 UTC = besoknya)', nomorSertifikat({ ...dasar, submitted_at: '2026-10-09T20:00:00Z' }) === 'LC-20261010-A1B2C3');
cek('nomor sama tiap dipanggil', nomorSertifikat(dasar) === nomorSertifikat({ ...dasar }));
cek('tanggal panjang Indonesia', tanggalSertifikat(dasar.submitted_at) === '9 Oktober 2026');
cek('judul panjang dipotong dengan …', ringkasJudul('x'.repeat(100), 20).length === 20 && ringkasJudul('pendek') === 'pendek');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
