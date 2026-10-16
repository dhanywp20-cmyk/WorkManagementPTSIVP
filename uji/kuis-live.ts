/**
 * uji/kuis-live.ts - aturan Kuis Live (ala Kahoot) Kelas Eksternal.
 *
 *   npx tsx uji/kuis-live.ts
 */
import {
  HASIL_MS, HITUNG_MUNDUR_MS, PAPAN_MS, TOLERANSI_MS, distribusi, indeksTerhitung, jadwalLive, periksaJawab, poinKahoot,
  posisiSaya, rapikanDetik, rapikanUrlGambar, rapikanWarna, semuaMenjawab, statusLive, susunPapan, tahapEfektif, transisiLive,
  wujudkanLive, type StatusLive, type UbahanLive,
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

//  Jadwal satu soal (20 dtk): siap 4 dtk -> soal 20 dtk (+toleransi) -> hasil -> papan -> soal berikutnya.
const S = 20_000;
const MULAI0 = T0 + HITUNG_MUNDUR_MS, HABIS0 = MULAI0 + S + TOLERANSI_MS;
const AKHIR_HASIL0 = HABIS0 + HASIL_MS, AKHIR_PAPAN0 = AKHIR_HASIL0 + PAPAN_MS;
const MULAI1 = AKHIR_PAPAN0 + HITUNG_MUNDUR_MS;

console.log('\n2. Mulai lalu berjalan SENDIRI mengikuti waktu (tanpa klik admin)');
const s1 = terapkan(lobi, transisiLive(lobi, 'live_mulai', T0, ['q1', 'q2', 'q3']));
{
  cek('sesi naik jadi 1', s1.live_sesi === 1);
  cek('mulai di soal pertama', s1.live_tahap === 'soal' && s1.live_indeks === 0);
  cek('urutan soal disimpan', s1.live_urutan.join() === 'q1,q2,q3');
  const t = (x: number) => { const j = jadwalLive(s1, x); return `${j.tahap}:${j.indeks}`; };
  cek('hitung mundur dulu (siap)', t(T0 + 1000) === 'siap:0');
  cek('pilihan terbuka setelah hitung mundur', t(MULAI0) === 'soal:0');
  cek('masih soal sampai batas + toleransi', t(HABIS0 - 1) === 'soal:0');
  cek('lalu hasil (kunci & distribusi)', t(HABIS0) === 'hasil:0');
  cek('lalu papan skor', t(AKHIR_HASIL0) === 'papan:0');
  cek('lalu otomatis soal 2 dengan hitung mundur', t(AKHIR_PAPAN0) === 'siap:1');
  cek('soal 2 terbuka', t(MULAI1) === 'soal:1');
  const j1 = jadwalLive(s1, MULAI1 + 1000);
  cek('soal 2 waktu penuh lagi', j1.tutupMs! - j1.mulaiMs! === S);
  cek('akhir tahap dilaporkan (untuk hitung mundur di layar)', jadwalLive(s1, HABIS0 + 10).akhirMs === AKHIR_HASIL0);
  //  Soal ke-3 (terakhir): sesudah papan-nya -> selesai (podium).
  const satuPutaran = AKHIR_PAPAN0 - T0;
  const akhirSemua = T0 + 3 * satuPutaran;
  cek('papan soal terakhir', t(akhirSemua - 1) === 'papan:2');
  cek('setelah soal terakhir otomatis selesai', t(akhirSemua) === 'selesai:2');
  cek('selesai tidak punya akhir otomatis', jadwalLive(s1, akhirSemua + 999_999).akhirMs === null);
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

console.log('\n4. Jawaban mengikuti soal yang sedang berjalan menurut jadwal');
{
  const a = periksaJawab(s1, 1, 'D', MULAI1 + 3000);
  cek('soal 2 (sudah maju otomatis) menerima jawaban', a.ok);
  cek('waktu jawab dihitung dari pilihan soal 2 dibuka', a.ok && a.waktuMs === 3000, a.ok ? String(a.waktuMs) : '');
  cek('indeks soal 1 ditolak saat soal 2', !periksaJawab(s1, 0, 'D', MULAI1 + 3000).ok);
  cek('saat hasil ditolak (waktu habis)', !periksaJawab(s1, 0, 'A', HABIS0 + 100).ok);
  cek('saat soal 1 berjalan belum ada yang dihitung', indeksTerhitung(s1, MULAI0 + 1000) === -1);
  cek('setelah waktu soal 1 habis, soal 1 dihitung', indeksTerhitung(s1, HABIS0 + 1) === 0);
  cek('saat soal 2 berjalan hanya soal 1 yang dihitung', indeksTerhitung(s1, MULAI1 + 1000) === 0);
}

console.log('\n5. Lewati: maju satu tahap sekarang juga');
{
  const x = MULAI0 + 2000;
  const lewat = terapkan(s1, transisiLive(s1, 'live_lewati', x));
  cek('soal -> hasil sekarang', tahapEfektif(lewat, x) === 'hasil');
  cek('jawaban sesudahnya ditolak', !periksaJawab(lewat, 0, 'A', x).ok);
  cek('jadwal sesudahnya ikut maju (papan tepat setelah hasil)', tahapEfektif(lewat, x + HASIL_MS) === 'papan');
  const lewatSiap = terapkan(s1, transisiLive(s1, 'live_lewati', T0 + 1000));
  cek('Lewati saat hitung mundur: mulai <= tutup', Date.parse(lewatSiap.live_soal_mulai!) <= Date.parse(lewatSiap.live_soal_tutup!));
  const kePapan = terapkan(lewat, transisiLive(lewat, 'live_lewati', x + 1000));
  cek('hasil -> papan sekarang', tahapEfektif(kePapan, x + 1000) === 'papan');
  const keSoal2 = terapkan(kePapan, transisiLive(kePapan, 'live_lewati', x + 2000));
  cek('papan -> soal berikutnya (hitung mundur)', jadwalLive(keSoal2, x + 2000).tahap === 'siap' && keSoal2.live_indeks === 1);
  cek('soal berikutnya mulai 4 dtk lagi', Date.parse(keSoal2.live_soal_mulai!) === x + 2000 + HITUNG_MUNDUR_MS);
  //  Jadwal sudah maju otomatis ke soal 2 tapi basis data masih mencatat soal 1.
  const y = MULAI1 + 1000;
  const lewat2 = terapkan(s1, transisiLive(s1, 'live_lewati', y));
  cek('Lewati memakai soal menurut jadwal (soal 2), bukan catatan lama', lewat2.live_indeks === 1 && tahapEfektif(lewat2, y) === 'hasil');
  //  Papan soal terakhir -> selesai.
  const terakhir: StatusLive = { ...s1, live_indeks: 2, live_soal_mulai: iso(T0), live_soal_tutup: iso(T0 + S) };
  const zPapan = T0 + S + TOLERANSI_MS + HASIL_MS + 10;
  const akhir = terapkan(terakhir, transisiLive(terakhir, 'live_lewati', zPapan));
  cek('papan soal terakhir -> selesai (podium)', akhir.live_tahap === 'selesai');
  cek('Lewati setelah selesai ditolak', 'galat' in transisiLive(akhir, 'live_lewati', zPapan + 1));
  const ulang = terapkan(akhir, transisiLive(akhir, 'live_ulang', zPapan + 2));
  cek('Main lagi -> lobi', tahapEfektif(ulang, zPapan + 2) === 'lobi');
  const sesi2 = terapkan(ulang, transisiLive(ulang, 'live_mulai', zPapan + 3, ['q1']));
  cek('Mulai lagi = sesi baru (skor lama tetap tersimpan)', sesi2.live_sesi === 2 && sesi2.live_indeks === 0);
  cek('nama lama live_lanjut tetap bekerja', !('galat' in transisiLive(s1, 'live_lanjut', x)));
}
{
  const akhiri = terapkan(s1, transisiLive(s1, 'live_akhiri', MULAI0 + 2000));
  cek('Akhiri di tengah soal -> selesai', tahapEfektif(akhiri, MULAI0 + 2000) === 'selesai');
  cek('Akhiri di tengah soal: jawaban berikutnya ditolak', !periksaJawab(akhiri, 0, 'A', MULAI0 + 2000).ok);
  cek('Akhiri dari lobi ditolak', 'galat' in transisiLive(lobi, 'live_akhiri', T0));
  const selesaiOtomatis = T0 + 3 * (AKHIR_PAPAN0 - T0);
  cek('Main lagi dari selesai otomatis (catatan masih "soal")', !('galat' in transisiLive(s1, 'live_ulang', selesaiOtomatis)));
}
{
  cek('wujudkan: belum maju = tidak ada yang ditulis', wujudkanLive(s1, MULAI0) === null);
  const w = wujudkanLive(s1, MULAI1 + 10);
  cek('wujudkan: catat soal 2 beserta waktunya', !!w && w.live_indeks === 1 && Date.parse(w.live_soal_mulai!) === MULAI1);
  const w2 = wujudkanLive(s1, T0 + 3 * (AKHIR_PAPAN0 - T0));
  cek('wujudkan: catat selesai', !!w2 && w2.live_tahap === 'selesai' && w2.live_indeks === 2);
  const lama: StatusLive = { ...s1, live_tahap: 'papan' };
  cek('papan tersimpan (versi lama) menunggu admin', jadwalLive(lama, T0 + 9_999_999).tahap === 'papan');
  cek('papan tersimpan + Lewati -> soal berikutnya', terapkan(lama, transisiLive(lama, 'live_lewati', T0)).live_indeks === 1);
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
  const st = (k: Partial<StatusLive>, aktif: boolean, maks: number, n: number, t = T0) => statusLive({ ...lobi, ...k, aktif, maks_peserta: maks }, n, t);
  cek('lobi terbuka', st({}, true, 10, 3) === 'buka');
  cek('masuk di tengah permainan tetap boleh', st(s1, true, 10, 3, MULAI0) === 'buka');
  cek('setelah selesai tertutup', st({ live_tahap: 'selesai' }, true, 10, 3) === 'selesai');
  cek('selesai otomatis juga tertutup', st(s1, true, 10, 3, T0 + 3 * (AKHIR_PAPAN0 - T0)) === 'selesai');
  cek('penuh', st({}, true, 3, 3) === 'penuh');
  cek('nonaktif', st({}, false, 10, 0) === 'nonaktif');
  cek('warna tema dirapikan', rapikanWarna('#46178F') === '#46178f' && rapikanWarna('merah') === null);
  cek('gambar hanya dari folder unggahan kuis', rapikanUrlGambar('https://x.supabase.co/storage/v1/object/public/merek-files/kuis-live/logo-1.png') !== null
    && rapikanUrlGambar('https://situs-lain.com/a.png') === null);
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
