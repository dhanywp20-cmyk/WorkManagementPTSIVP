/*
  UJI: periksaSkema() menolak dua tahapan pencairan dengan "Tahun ke-" yang
  sama.

  Bug nyata dari laporan: proyek "Korlantas TMC Soreang" (BAST Agu 2026)
  tahapan T3-nya tercatat "Tahun 2027" - PERSIS sama dengan T1 - padahal
  seharusnya BAST + 3 = 2029. Sudah dicoba "Hapus Tahapan" lalu digenerate
  ulang, hasilnya tetap sama. generateTranches() sendiri sudah benar (BAST +
  tahunKe per tahapan, dibuktikan uji/tahapan-installer.ts) - artinya sumber
  angka yang salah ada di skema TERSIMPAN: dua entri sk.tranche kebetulan
  punya `tahunKe` yang sama, kemungkinan sisa dari cara lama sebelum porsi
  Installer dipindah jadi baris tambahan (dulu tahap terakhir "diambil alih"
  untuk Installer, dan seseorang mungkin pernah menyamakan tahunKe-nya secara
  manual sebagai workaround).

  periksaSkema() sebelumnya tidak pernah memeriksa hal ini - total tahapan
  tetap 100% walau dua tahapannya berbagi tahun yang sama, jadi tidak ada
  peringatan apa pun sampai tahapannya sungguh tergenerate salah. Uji ini
  membuktikan validasinya sekarang menangkap kasus itu SEBELUM admin
  menyimpan skema yang rusak.

    npx tsx uji/tahun-tahapan-kembar.ts
*/
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://x.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'dummy';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ||= 'https://y.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY ||= 'dummy';

import { periksaSkema, SKEMA_BAWAAN, type SkemaInsentif } from '../lib/incentive-scheme';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

console.log('\n1. Skema bawaan (Tahun 1/2/3) - tidak ada masalah tranche');
{
  const masalah = periksaSkema(SKEMA_BAWAAN).filter(m => m.bidang === 'tranche');
  ok('Tidak ada masalah tahapan pada skema bawaan', masalah.length === 0, JSON.stringify(masalah));
}

console.log('\n2. Kasus nyata: T3 kebetulan bertahun sama dengan T1');
{
  const sk: SkemaInsentif = {
    ...SKEMA_BAWAAN,
    tranche: [
      { nomor: 1, persen: 50, tahunKe: 1 },
      { nomor: 2, persen: 35, tahunKe: 2 },
      { nomor: 3, persen: 15, tahunKe: 1 }, // <- bug: harusnya 3
    ],
  };
  const masalah = periksaSkema(sk).filter(m => m.bidang === 'tranche');
  ok('Ditolak - ada tahunKe kembar', masalah.some(m => m.pesan.includes('sama')));
}

console.log('\n3. "Tahun ke-" nol atau negatif ditolak');
{
  const sk: SkemaInsentif = {
    ...SKEMA_BAWAAN,
    tranche: [
      { nomor: 1, persen: 50, tahunKe: 0 },
      { nomor: 2, persen: 50, tahunKe: 1 },
    ],
  };
  const masalah = periksaSkema(sk).filter(m => m.bidang === 'tranche');
  ok('Ditolak - tahunKe minimal 1', masalah.some(m => m.pesan.includes('minimal 1')));
}

console.log('\n4. Tahapan dua tahun yang berbeda (1 dan 2) tetap lolos');
{
  const sk: SkemaInsentif = {
    ...SKEMA_BAWAAN,
    tranche: [
      { nomor: 1, persen: 60, tahunKe: 1 },
      { nomor: 2, persen: 40, tahunKe: 2 },
    ],
  };
  const masalah = periksaSkema(sk).filter(m => m.bidang === 'tranche');
  ok('Tidak ada masalah - tahunKe berbeda', masalah.length === 0, JSON.stringify(masalah));
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
