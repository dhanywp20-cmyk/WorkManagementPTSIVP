/**
 * uji/kuis-live.ts - aturan Kuis Live (ala Kahoot) Kelas Eksternal.
 *
 *   npx tsx uji/kuis-live.ts
 */
import {
  HITUNG_MUNDUR_MS, TOLERANSI_MS, distribusi, indeksTerhitung, periksaJawab, poinKahoot, posisiSaya, rapikanDetik,
  semuaMenjawab, statusLive, susunPapan, tahapEfektif, transisiLive, type StatusLive, type UbahanLive,
} from '../lib/kuis-live';
import { rapikanKelas } from '../lib/kelas-eksternal';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};

const T0 = Date.parse('2026-10-15T03:00:00Z');
const iso = (t: number) => new Date(t).toISOString();
const lobi: StatusLive = {
  detik_per_soal: 20, live_tahap: 'lobi', live_indeks: 0, live_urutan: [],
  live_soal_mulai: null, live_soal_tutup: null, live_sesi: 0,
};
/** Terapkan ubahan ke status (seperti UPDATE di basis data). */
const terapkan = (k: StatusLive, u: UbahanLive | { galat: string }): StatusLive => {
  if ('galat' in u) throw new Error(u.galat);
  return { ...k, ...u } as StatusLive;
};

console.log('\n1. Peserta tidak bisa mulai sebelum admin menekan Mulai');
{
  cek('lobi tetap lobi selama apa pun', tahapEfektif(lobi, T0 + 3_600_000) === 'lobi');
  const j = periksaJawab(lobi, 0, 'A', T0);
  cek('jawaban di lobi ditolak', !j.ok && j.alasan === 'Kuis belum dimulai.');
  cek('Mulai tanpa soal sah ditolak', 'galat' in transisiLive(lobi, 'live_mulai', T0, []));
}

console.log('\n2. Mulai -> hitung mundur -> soal -> hasil (dari jam, tanpa penjadwal)');
const s1 = terapkan(lobi, transisiLive(lobi, 'live_mulai', T0, ['q1', 'q2', 'q3']));
{
  cek('sesi naik jadi 1', s1.live_sesi === 1);
  cek('mulai di soal pertama', s1.live_tahap === 'soal' && s1.live_indeks === 0);
  cek('urutan soal disimpan', s1.live_urutan.join() === 'q1,q2,q3');
  cek('hitung mundur dulu (siap)', tahapEfektif(s1, T0 + 1000) === 'siap');
  cek('jawaban saat hitung mundur ditolak', !periksaJawab(s1, 0, 'A', T0 + 1000).ok);
  cek('pilihan terbuka setelah hitung mundur', tahapEfektif(s1, T0 + HITUNG_MUNDUR_MS) === 'soal');
  cek('masih soal tepat di batas waktu (toleransi jaringan)', tahapEfektif(s1, T0 + HITUNG_MUNDUR_MS + 20_000 + TOLERANSI_MS - 1) === 'soal');
  cek('hasil setelah batas + toleransi', tahapEfektif(s1, T0 + HITUNG_MUNDUR_MS + 20_000 + TOLERANSI_MS) === 'hasil');
  cek('Mulai dua kali ditolak', 'galat' in transisiLive(s1, 'live_mulai', T0 + 5000, ['q1']));
}

console.log('\n3. Poin ala Kahoot (tanpa nilai lulus)');
{
  cek('benar seketika = 1000', poinKahoot(true, 0, 20_000) === 1000);
  cek('benar di tengah waktu = 750', poinKahoot(true, 10_000, 20_000) === 750);
  cek('benar di detik terakhir = 500', poinKahoot(true, 20_000, 20_000) === 500);
  cek('lewat waktu dijepit ke 500', poinKahoot(true, 99_000, 20_000) === 500);
  cek('salah = 0', poinKahoot(false, 0, 20_000) === 0);
  const a = periksaJawab(s1, 0, 'b', T0 + HITUNG_MUNDUR_MS + 5000);
  cek('jawaban diterima, huruf kecil dirapikan', a.ok && a.pilihan === 'B');
  cek('waktu jawab dihitung dari pilihan dibuka', a.ok && a.waktuMs === 5000, a.ok ? String(a.waktuMs) : '');
  cek('pilihan selain A-D ditolak', !periksaJawab(s1, 0, 'E', T0 + HITUNG_MUNDUR_MS + 5000).ok);
  cek('indeks soal lain ditolak', !periksaJawab(s1, 1, 'A', T0 + HITUNG_MUNDUR_MS + 5000).ok);
  const telat = periksaJawab(s1, 0, 'A', T0 + HITUNG_MUNDUR_MS + 20_500);
  cek('telat dalam toleransi diterima, waktu dijepit ke durasi', telat.ok && telat.waktuMs === 20_000);
  cek('setelah toleransi ditolak', !periksaJawab(s1, 0, 'A', T0 + HITUNG_MUNDUR_MS + 21_000).ok);
}

console.log('\n4. Skor soal berjalan tidak bocor sebelum waktu habis');
{
  cek('saat soal 1 berjalan belum ada yang dihitung', indeksTerhitung(s1, T0 + 6000) === -1);
  cek('setelah waktu habis soal 1 dihitung', indeksTerhitung(s1, T0 + 30_000) === 0);
}

console.log('\n5. Tombol admin: Lewati, Lanjut, papan, soal berikut, selesai');
{
  cek('Lanjut saat soal masih berjalan ditolak', 'galat' in transisiLive(s1, 'live_lanjut', T0 + 6000));
  const lewat = terapkan(s1, transisiLive(s1, 'live_tutup_soal', T0 + 6000));
  cek('Lewati: langsung hasil', tahapEfektif(lewat, T0 + 6000) === 'hasil');
  cek('Lewati: jawaban sesudahnya ditolak', !periksaJawab(lewat, 0, 'A', T0 + 6000).ok);
  const lewatSiap = terapkan(s1, transisiLive(s1, 'live_tutup_soal', T0 + 1000));
  cek('Lewati saat hitung mundur: mulai <= tutup', Date.parse(lewatSiap.live_soal_mulai!) <= Date.parse(lewatSiap.live_soal_tutup!));
  const papan = terapkan(lewat, transisiLive(lewat, 'live_lanjut', T0 + 8000));
  cek('hasil -> papan skor', papan.live_tahap === 'papan');
  const s2 = terapkan(papan, transisiLive(papan, 'live_lanjut', T0 + 10_000));
  cek('papan -> soal 2', s2.live_tahap === 'soal' && s2.live_indeks === 1);
  cek('soal 2 dengan hitung mundur baru', tahapEfektif(s2, T0 + 11_000) === 'siap');
  cek('soal 2 batas waktu penuh lagi', Date.parse(s2.live_soal_tutup!) - Date.parse(s2.live_soal_mulai!) === 20_000);
  //  Lompat ke soal terakhir.
  const s3hasil = { ...s2, live_indeks: 2, live_soal_tutup: iso(T0), live_soal_mulai: iso(T0 - 1000) };
  const papanAkhir = terapkan(s3hasil, transisiLive(s3hasil, 'live_lanjut', T0 + 60_000));
  const akhir = terapkan(papanAkhir, transisiLive(papanAkhir, 'live_lanjut', T0 + 61_000));
  cek('papan soal terakhir -> selesai (podium)', akhir.live_tahap === 'selesai');
  cek('Lanjut setelah selesai ditolak', 'galat' in transisiLive(akhir, 'live_lanjut', T0 + 62_000));
  const ulang = terapkan(akhir, transisiLive(akhir, 'live_ulang', T0 + 63_000));
  cek('Main lagi -> lobi', tahapEfektif(ulang, T0 + 63_000) === 'lobi');
  const sesi2 = terapkan(ulang, transisiLive(ulang, 'live_mulai', T0 + 64_000, ['q1']));
  cek('Mulai lagi = sesi baru (skor lama tetap tersimpan)', sesi2.live_sesi === 2 && sesi2.live_indeks === 0);
}
{
  const akhiri = terapkan(s1, transisiLive(s1, 'live_akhiri', T0 + 6000));
  cek('Akhiri di tengah soal -> selesai', akhiri.live_tahap === 'selesai');
  cek('Akhiri di tengah soal: jawaban berikutnya ditolak', !periksaJawab(akhiri, 0, 'A', T0 + 6000).ok);
  cek('Akhiri dari lobi ditolak', 'galat' in transisiLive(lobi, 'live_akhiri', T0));
}

console.log('\n6. Semua sudah menjawab -> soal ditutup lebih awal');
{
  cek('3 dari 3 = ya', semuaMenjawab(3, 3));
  cek('2 dari 3 = belum', !semuaMenjawab(2, 3));
  cek('tanpa peserta tidak dianggap selesai', !semuaMenjawab(0, 0));
}

console.log('\n7. Papan skor & posisi');
{
  const papan = susunPapan([
    { peserta_id: 'a', nama: 'Ani', poin: '1500', benar: 2, dijawab: 2, waktu_benar_ms: 9000 },
    { peserta_id: 'b', nama: 'Budi', poin: 1800, benar: 2, dijawab: 2, waktu_benar_ms: 4000 },
    { peserta_id: 'c', nama: 'Citra', poin: 1500, benar: 2, dijawab: 2, waktu_benar_ms: 7000 },
    { peserta_id: 'd', nama: 'Dodi', poin: 0, benar: 0, dijawab: 0, waktu_benar_ms: 0 },
    { peserta_id: 'e', nama: 'Eka', poin: 0, benar: 0, dijawab: 1, waktu_benar_ms: 0 },
  ]);
  cek('poin terbanyak di atas', papan[0].nama === 'Budi');
  cek('poin sama: yang lebih cepat di atas', papan[1].nama === 'Citra' && papan[2].nama === 'Ani');
  cek('bigint string jadi angka', papan[2].poin === 1500);
  cek('peringkat 1,2,3', papan.slice(0, 3).map(b => b.peringkat).join() === '1,2,3');
  cek('dua-duanya 0 poin = peringkat sama', papan[3].peringkat === 4 && papan[4].peringkat === 4);
  const ani = posisiSaya(papan, 'a');
  cek('posisi Ani ke-3 dari 5', ani?.peringkat === 3 && ani.jumlah === 5);
  cek('"di belakang" melompati yang poinnya sama: Ani di belakang Budi 300', ani?.atas?.nama === 'Budi' && ani.atas.selisih === 300);
  cek('jumlah benar ikut', ani?.benar === 2);
  cek('juara pertama tanpa "di belakang"', posisiSaya(papan, 'b')?.atas === null);
  cek('peserta tak dikenal = null', posisiSaya(papan, 'x') === null);
  cek('papan kosong aman', susunPapan([]).length === 0);
}

console.log('\n8. Distribusi, waktu per soal, status pendaftaran');
{
  const d = distribusi([{ pilihan: 'A' }, { pilihan: 'C' }, { pilihan: 'A' }, { pilihan: 'Z' }]);
  cek('distribusi A=2 C=1, sampah dibuang', d.A === 2 && d.B === 0 && d.C === 1 && d.D === 0);
  cek('detik dibulatkan ke pilihan terdekat', rapikanDetik(25) === 20 && rapikanDetik(1000) === 240 && rapikanDetik(1) === 5);
  cek('detik kosong = 20', rapikanDetik('') === 20 && rapikanDetik(undefined) === 20);
  cek('lobi terbuka', statusLive({ aktif: true, maks_peserta: 10, live_tahap: 'lobi' }, 3) === 'buka');
  cek('masuk di tengah permainan tetap boleh', statusLive({ aktif: true, maks_peserta: 10, live_tahap: 'soal' }, 3) === 'buka');
  cek('setelah selesai tertutup', statusLive({ aktif: true, maks_peserta: 10, live_tahap: 'selesai' }, 3) === 'selesai');
  cek('penuh', statusLive({ aktif: true, maks_peserta: 3, live_tahap: 'lobi' }, 3) === 'penuh');
  cek('nonaktif', statusLive({ aktif: false, maks_peserta: 10, live_tahap: 'lobi' }, 0) === 'nonaktif');
}

console.log('\n9. Isian admin');
{
  const id = '11111111-2222-3333-4444-555555555555';
  const live = rapikanKelas({ judul: 'Kuis', question_ids: [id], jenis: 'live', detik_per_soal: '30', buka_pada: '2026-10-15', maks_peserta: '1999' });
  cek('jenis live tersimpan', !('galat' in live) && live.jenis === 'live');
  cek('detik per soal tersimpan', !('galat' in live) && live.detik_per_soal === 30);
  cek('jadwal buka diabaikan untuk live', !('galat' in live) && live.buka_pada === null);
  cek('maks peserta live dibatasi 500', !('galat' in live) && live.maks_peserta === 500);
  const lama = rapikanKelas({ judul: 'Ujian', question_ids: [id] });
  cek('tanpa jenis = mandiri (kelas lama tidak berubah)', !('galat' in lama) && lama.jenis === 'mandiri');
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
