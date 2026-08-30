/**
 * uji/kelompok-insentif.ts - kapan beberapa jadwal dihitung SATU proyek insentif.
 *
 *   npx tsx uji/kelompok-insentif.ts
 */
import {
  gabungkanProyek, deteksiKandidatGabung, idUntukDigabung, kunciProyek, normalkanNama,
  type BarisKelompok,
} from '../lib/kelompok-insentif';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};
const b = (o: Partial<BarisKelompok> & { id: string }): BarisKelompok => ({
  project_name: 'BPKP Aceh', assigned_to: 'yoga', assign_name: 'Yoga KS',
  due_date: '2026-08-31', bast_date: '2026-09-01', batch_id: null,
  incentive_group_id: null, category: 'Konfigurasi', ...o,
});

console.log('\n1. Penggabungan menurut penanda yang sudah ditetapkan');
{
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', due_date: '2026-08-27' }),
    b({ id: 'b', batch_id: 'B1', due_date: '2026-08-31' }),
  ]);
  cek('jadwal 5 hari (batch) jadi 1', hasil.length === 1);
  cek('yang dipakai tanggal terakhir', hasil[0].due_date === '2026-08-31', hasil[0].due_date ?? '');
}
{
  // Konfigurasi Senin + Training 3 hari kemudian, sudah digabung manusia.
  const hasil = gabungkanProyek([
    b({ id: 'a', category: 'Konfigurasi', due_date: '2026-08-24', incentive_group_id: 'G1' }),
    b({ id: 'b', category: 'Training',    due_date: '2026-08-27', incentive_group_id: 'G1' }),
  ]);
  cek('dua kategori satu kelompok jadi 1', hasil.length === 1);
  cek('kategori yang menang dari tanggal terakhir', hasil[0].category === 'Training', hasil[0].category ?? '');
}
{
  // Kelompok manusia harus MELEBUR batch, bukan berdampingan dengannya.
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', incentive_group_id: 'G1', due_date: '2026-08-24' }),
    b({ id: 'b', batch_id: 'B1', incentive_group_id: 'G1', due_date: '2026-08-25' }),
    b({ id: 'c', batch_id: 'B2', incentive_group_id: 'G1', due_date: '2026-08-28' }),
    b({ id: 'd', batch_id: 'B2', incentive_group_id: 'G1', due_date: '2026-08-29' }),
  ]);
  cek('dua batch dalam satu kelompok jadi 1', hasil.length === 1, String(hasil.length));
}
{
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', assigned_to: 'yoga' }),
    b({ id: 'b', batch_id: 'B1', assigned_to: 'dinan' }),
  ]);
  cek('dua penangan dalam satu batch tetap 2', hasil.length === 2, String(hasil.length));
}
{
  const hasil = gabungkanProyek([b({ id: 'a' }), b({ id: 'b' })]);
  cek('tanpa penanda apa pun tidak saling menelan', hasil.length === 2);
}

console.log('\n2. Deteksi hanya MENANDAI');
{
  const data = [
    b({ id: 'a', category: 'Konfigurasi', due_date: '2026-08-24', bast_date: '2026-09-01' }),
    b({ id: 'b', category: 'Training',    due_date: '2026-08-27', bast_date: '2026-09-01' }),
  ];
  const k = deteksiKandidatGabung(data);
  cek('BAST sama + nama sama = kandidat', k.length === 1, String(k.length));
  cek('kedua jadwal masuk kandidat', k[0]?.anggota.length === 2);
  // Yang paling penting: mendeteksi TIDAK mengubah apa pun.
  cek('data asli tidak tersentuh',
    data.every(r => r.incentive_group_id === null));
  cek('gabungkanProyek tetap melihatnya 2', gabungkanProyek(data).length === 2);
}
{
  // Dua kontrak berbeda untuk klien yang sama: BAST beda, harus TETAP terpisah.
  const k = deteksiKandidatGabung([
    b({ id: 'a', bast_date: '2026-09-01' }),
    b({ id: 'b', bast_date: '2026-11-20' }),
  ]);
  cek('BAST berbeda bukan kandidat', k.length === 0);
}
{
  // Dua proyek berbeda kebetulan serah-terima di hari yang sama.
  const k = deteksiKandidatGabung([
    b({ id: 'a', project_name: 'BPKP Aceh',  bast_date: '2026-09-01' }),
    b({ id: 'b', project_name: 'BPKP Medan', bast_date: '2026-09-01' }),
  ]);
  cek('nama berbeda bukan kandidat walau BAST sama', k.length === 0);
}
{
  const k = deteksiKandidatGabung([
    b({ id: 'a', project_name: '  BPKP   Aceh ' }),
    b({ id: 'b', project_name: 'bpkp aceh' }),
  ]);
  cek('beda spasi & huruf besar tetap terdeteksi', k.length === 1);
}
{
  // Tanpa BAST tidak ada penanda yang bisa dipercaya - jangan menebak.
  const k = deteksiKandidatGabung([
    b({ id: 'a', bast_date: null }),
    b({ id: 'b', bast_date: null }),
  ]);
  cek('tanpa BAST tidak ditandai', k.length === 0);
}
{
  const k = deteksiKandidatGabung([
    b({ id: 'a', incentive_group_id: 'G1' }),
    b({ id: 'b', incentive_group_id: 'G1' }),
  ]);
  cek('yang sudah diputuskan tidak ditanya lagi', k.length === 0);
}

console.log('\n3. Menggabungkan menandai SELURUH baris, bukan wakilnya saja');
{
  const semua = [
    b({ id: 'a1', batch_id: 'B1', due_date: '2026-08-24', category: 'Konfigurasi' }),
    b({ id: 'a2', batch_id: 'B1', due_date: '2026-08-25', category: 'Konfigurasi' }),
    b({ id: 'b1', batch_id: 'B2', due_date: '2026-08-27', category: 'Training' }),
    b({ id: 'b2', batch_id: 'B2', due_date: '2026-08-28', category: 'Training' }),
    b({ id: 'lain', project_name: 'Proyek Lain', batch_id: null }),
  ];
  const k = deteksiKandidatGabung(semua);
  cek('terdeteksi 1 kandidat', k.length === 1, String(k.length));
  const ids = idUntukDigabung(k[0], semua).sort();
  cek('KEEMPAT baris ikut ditandai, bukan 2 wakilnya',
    JSON.stringify(ids) === '["a1","a2","b1","b2"]', JSON.stringify(ids));
  cek('proyek lain tidak ikut terseret', !ids.includes('lain'));
}

console.log('\n4. Hal-hal kecil yang mudah terlewat');
{
  cek('normalkanNama merapikan spasi ganda', normalkanNama('  A   B ') === 'a b');
  cek('kunci kelompok menang atas batch',
    kunciProyek(b({ id: 'x', batch_id: 'B1', incentive_group_id: 'G1' })) === 'grup:G1');
  cek('daftar kosong aman', gabungkanProyek([]).length === 0 && deteksiKandidatGabung([]).length === 0);
}

console.log('\n5. BAST dipinjam dari baris lain sekelompok bila wakilnya sendiri kosong (kasus Steak 21)');
{
  // Baris wakil (due_date terakhir) justru yang tidak pernah kebagian BAST -
  // persis skenario nyata sebelum perbaikan handleModeConfirm menulis ke
  // SELURUH baris batch.
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', due_date: '2026-06-15', bast_date: '2026-06-17' }),
    b({ id: 'b', batch_id: 'B1', due_date: '2026-06-17', bast_date: null }),
  ]);
  cek('tetap 1 proyek', hasil.length === 1);
  cek('BAST dipinjam dari baris lain, bukan tampil kosong',
    hasil[0].bast_date === '2026-06-17', String(hasil[0].bast_date));
  cek('baris wakil yang dipakai tetap yang due_date terakhir (id b)',
    hasil[0].id === 'b');
}
{
  // Kalau memang tidak ada satu pun baris berisi BAST, jangan mengarang.
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', due_date: '2026-06-15', bast_date: null }),
    b({ id: 'b', batch_id: 'B1', due_date: '2026-06-17', bast_date: null }),
  ]);
  cek('tanpa BAST sama sekali tetap kosong, bukan dipaksakan', hasil[0].bast_date == null);
}
{
  // Wakil yang SUDAH punya BAST sendiri tidak boleh ketiban nilai pinjaman.
  const hasil = gabungkanProyek([
    b({ id: 'a', batch_id: 'B1', due_date: '2026-06-15', bast_date: '2026-06-15' }),
    b({ id: 'b', batch_id: 'B1', due_date: '2026-06-17', bast_date: '2026-06-17' }),
  ]);
  cek('wakil pakai BAST miliknya sendiri, bukan pinjaman', hasil[0].bast_date === '2026-06-17');
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
