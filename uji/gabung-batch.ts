/**
 * uji/gabung-batch.ts - satu jadwal multi-tanggal = satu proyek insentif.
 *
 *   npx tsx uji/gabung-batch.ts
 */
import { gabungkanPerBatch } from '../app/incentive-pts/_components/calc';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};
const r = (id: string, batch: string | null, tgl: string, orang = 'taufik') =>
  ({ id, batch_id: batch, due_date: tgl, assigned_to: orang });

console.log('\n1. Hari dilipat, proyek tidak berganda');
{
  // Kasus nyata: Celebrity Fitness MOI, Konfigurasi 2 hari, tercatat 2 baris.
  const hasil = gabungkanPerBatch([
    r('a', 'B1', '2026-08-07'),
    r('b', 'B1', '2026-08-08'),
  ]);
  cek('2 baris jadi 1 proyek', hasil.length === 1, String(hasil.length));
  cek('yang dipakai tanggal TERAKHIR', hasil[0].due_date === '2026-08-08', hasil[0].due_date);
}
{
  const lima = ['2026-08-27','2026-08-28','2026-08-29','2026-08-30','2026-08-31']
    .map((d, i) => r(`x${i}`, 'B5', d));
  cek('jadwal 5 hari jadi 1 proyek', gabungkanPerBatch(lima).length === 1);
}

console.log('\n2. Yang TIDAK boleh ikut terlipat');
{
  // Ini yang paling merugikan kalau salah: penangan kedua kehilangan haknya.
  const hasil = gabungkanPerBatch([
    r('a', 'B1', '2026-08-07', 'taufik'),
    r('b', 'B1', '2026-08-08', 'taufik'),
    r('c', 'B1', '2026-08-07', 'dinan'),
    r('d', 'B1', '2026-08-08', 'dinan'),
  ]);
  cek('2 penangan tetap 2 baris', hasil.length === 2, String(hasil.length));
  cek('kedua nama masih ada',
    new Set(hasil.map(h => h.assigned_to)).size === 2,
    hasil.map(h => h.assigned_to).join(','));
}
{
  const hasil = gabungkanPerBatch([
    r('a', 'B1', '2026-08-07'),
    r('b', 'B2', '2026-08-07'),
  ]);
  cek('batch berbeda tidak digabung', hasil.length === 2);
}
{
  // Jadwal sehari tidak punya batch_id - tidak boleh saling menelan.
  const hasil = gabungkanPerBatch([
    r('a', null, '2026-08-07'),
    r('b', null, '2026-08-07'),
    r('c', null, '2026-08-08'),
  ]);
  cek('baris tanpa batch dibiarkan utuh', hasil.length === 3, String(hasil.length));
}

console.log('\n3. Hasilnya harus tetap dan terurut');
{
  const masukan = [
    r('a', 'B1', '2026-08-07'), r('b', 'B1', '2026-08-08'),
    r('c', null, '2026-09-01'), r('d', 'B2', '2026-07-01'),
  ];
  const satu = gabungkanPerBatch(masukan).map(h => h.id).join(',');
  const dua  = gabungkanPerBatch([...masukan].reverse()).map(h => h.id).join(',');
  cek('urutan menurun menurut tanggal', satu === 'c,b,d', satu);
  cek('urutan masukan tidak mengubah hasil', satu === dua, `${satu} vs ${dua}`);
}
{
  // Tanggal seri di satu batch: harus memilih yang sama tiap kali dipanggil,
  // kalau tidak daftar insentif berubah-ubah sendiri antar pemuatan.
  const seri = [r('zz', 'B1', '2026-08-07'), r('aa', 'B1', '2026-08-07')];
  const s1 = gabungkanPerBatch(seri)[0].id;
  const s2 = gabungkanPerBatch([...seri].reverse())[0].id;
  cek('tanggal seri memilih baris yang sama', s1 === s2, `${s1} vs ${s2}`);
}
{
  cek('daftar kosong aman', gabungkanPerBatch([]).length === 0);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
