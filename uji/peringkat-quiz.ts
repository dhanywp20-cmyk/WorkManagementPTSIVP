/**
 * uji/peringkat-quiz.ts - hitungPeringkat() (lib/learning-rank.ts).
 *
 * Fungsi ini menggantikan "Top Performers" lama yang (a) mengirim nama & skor
 * SELURUH peserta ke browser lalu cuma disamarkan CSS blur() - bukan proteksi
 * sungguhan, dan (b) selalu kosong untuk Guest/Sales karena RLS lc_quiz_attempts
 * menahan mereka membaca baris siapa pun selain dirinya. hitungPeringkat cuma
 * mengembalikan ANGKA milik si pemanggil - tidak pernah nama/skor orang lain.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_URL=https://y.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY=dummy \
 *   npx tsx uji/peringkat-quiz.ts
 */
import { hitungPeringkat, type BarisAttempt } from '../lib/learning-rank';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}
function sama(nama: string, dapat: unknown, harap: unknown) {
  ok(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

function baris(user_id: string, score: number, role: string, divisi: string | null, status: string | null = 'graded'): BarisAttempt {
  return { user_id, score, grading_status: status, role, sales_division: divisi };
}

console.log('\n1. Kasus dasar: 5 sesama Guest, satu di antaranya si pemanggil');
{
  const rows = [
    baris('u1', 95, 'guest', 'Jakarta'),
    baris('u2', 90, 'guest', 'Jakarta'),
    baris('u3', 85, 'guest', 'Bandung'),
    baris('u4', 80, 'guest', 'Jakarta'),
    baris('u5', 70, 'guest', 'Bandung'),
  ];
  const hasil = hitungPeringkat(rows, { id: 'u3', role: 'guest', sales_division: 'Bandung' });
  sama('Global: peringkat 3 dari 5', [hasil.globalRank, hasil.globalTotal], [3, 5]);
  sama('Divisi Bandung: peringkat 1 dari 2 (u3=85, u5=70)', [hasil.divisiRank, hasil.divisiTotal], [1, 2]);
}

console.log('\n2. Role lain TIDAK ikut tercampur ke peer group');
{
  const rows = [
    baris('u1', 99, 'guest', null),
    baris('t1', 100, 'team', null),   // skor tertinggi, tapi beda role - tidak boleh menggeser peringkat guest
    baris('t2', 95, 'team', null),
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('u1 tetap peringkat 1 dari 1 di kelompok guest', [hasil.globalRank, hasil.globalTotal], [1, 1]);
}

console.log('\n3. "guest" dan "sales" TIDAK digabung (sesuai label lama "Top Performers — Guest")');
{
  const rows = [
    baris('g1', 90, 'guest', null),
    baris('s1', 95, 'sales', null),
  ];
  const hasilGuest = hitungPeringkat(rows, { id: 'g1', role: 'guest', sales_division: null });
  sama('Guest g1 peringkat 1 dari 1 (sales tidak ikut)', [hasilGuest.globalRank, hasilGuest.globalTotal], [1, 1]);
  const hasilSales = hitungPeringkat(rows, { id: 's1', role: 'sales', sales_division: null });
  sama('Sales s1 peringkat 1 dari 1 (guest tidak ikut)', [hasilSales.globalRank, hasilSales.globalTotal], [1, 1]);
}

console.log('\n4. Attempt pending_review (belum dinilai) tidak ikut dihitung');
{
  const rows = [
    baris('u1', 60, 'guest', null),
    baris('u2', 200, 'guest', null, 'pending_review'), // skor mentah tinggi tapi belum final
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('u2 (pending) tidak ikut peer group', hasil.globalTotal, 1);
  sama('u1 tetap peringkat 1', hasil.globalRank, 1);
}

console.log('\n5. Rata-rata dari beberapa attempt per orang, bukan attempt terakhir saja');
{
  const rows = [
    baris('u1', 100, 'guest', null), baris('u1', 50, 'guest', null),   // avg 75
    baris('u2', 60, 'guest', null), baris('u2', 60, 'guest', null),    // avg 60
  ];
  const hasil = hitungPeringkat(rows, { id: 'u2', role: 'guest', sales_division: null });
  sama('u2 (avg 60) di bawah u1 (avg 75) -> peringkat 2', hasil.globalRank, 2);
}

console.log('\n6. Belum pernah quiz sama sekali -> null, bukan 0 atau error');
{
  const rows = [baris('u1', 80, 'guest', null)];
  const hasil = hitungPeringkat(rows, { id: 'tidak-ada', role: 'guest', sales_division: null });
  sama('globalRank null (bukan 0)', hasil.globalRank, null);
  sama('globalTotal tetap menghitung yang lain', hasil.globalTotal, 1);
}

console.log('\n7. Tidak punya sales_division (mis. Team) -> divisiRank null, bukan 0');
{
  const rows = [baris('t1', 80, 'team', null)];
  const hasil = hitungPeringkat(rows, { id: 't1', role: 'team', sales_division: null });
  sama('divisiRank null karena caller tidak punya divisi', hasil.divisiRank, null);
  sama('divisiTotal 0', hasil.divisiTotal, 0);
}

console.log('\n8. Baris yatim (user tidak ditemukan / role null) tidak ikut & tidak meledak');
{
  const rows: BarisAttempt[] = [
    baris('u1', 80, 'guest', null),
    { user_id: 'hantu', score: 999, grading_status: 'graded', role: null, sales_division: null },
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('Baris yatim tidak ikut peer group', hasil.globalTotal, 1);
}


/*
  PAPAN PERINGKAT - penyamaran nama terjadi di SERVER, bukan lewat blur() CSS.

  Ini bagian yang paling mudah salah dan paling mahal kalau salah: kalau nama
  asli ikut terkirim lalu "disembunyikan" di sisi tampilan, ia tetap terbaca
  utuh oleh siapa pun yang membuka Network tab - dan tidak ada satu pun
  pengujian tampilan yang akan menangkapnya. Yang diuji di sini karena itu
  bukan tampilannya, melainkan ISI data yang keluar dari hitungPeringkat.
*/
console.log('\n9. Papan peringkat: hanya nama SENDIRI yang asli');
{
  const rows: BarisAttempt[] = [
    { user_id: 'u1', score: 90, grading_status: null, role: 'guest', sales_division: 'Jakarta', full_name: 'Ana Pertama', passed: true,  tab_switches: 0 },
    { user_id: 'u2', score: 80, grading_status: null, role: 'guest', sales_division: 'Jakarta', full_name: 'Budi Kedua',  passed: true,  tab_switches: 2 },
    { user_id: 'u3', score: 70, grading_status: null, role: 'guest', sales_division: 'Bandung', full_name: 'Cakra Ketiga',passed: false, tab_switches: 0 },
  ];
  const h = hitungPeringkat(rows, { id: 'u2', role: 'guest', sales_division: 'Jakarta' });

  ok('Papan memuat seluruh peserta sekelompok', h.papan.length === 3);
  ok('Baris sendiri bernama asli', h.papan.find(p => p.aku)?.nama === 'Budi Kedua');
  ok('Baris sendiri ditandai aku=true tepat satu', h.papan.filter(p => p.aku).length === 1);

  const namaLain = h.papan.filter(p => !p.aku).map(p => p.nama);
  ok('Nama peserta lain TIDAK ada yang asli',
    !namaLain.includes('Ana Pertama') && !namaLain.includes('Cakra Ketiga'), namaLain.join(', '));
  ok('Nama peserta lain berbentuk "Peserta #N"', namaLain.every(n => /^Peserta #\d+$/.test(n)));

  //  Penjagaan paling penting: nama asli siapa pun selain pemanggil tidak
  //  boleh muncul DI MANA PUN pada hasil - termasuk lewat field yang
  //  ditambahkan belakangan tanpa sadar ikut membawa nama.
  const semuaTeks = JSON.stringify(h);
  ok('Nama asli peserta lain tidak bocor di seluruh hasil',
    !semuaTeks.includes('Ana Pertama') && !semuaTeks.includes('Cakra Ketiga'));

  ok('Urutan papan menurun menurut skor', h.papan.map(p => p.rank).join() === '1,2,3');
  ok('Angka peserta lain tetap dikirim (papan tanpa angka tidak ada gunanya)',
    h.papan[0].avg === 90 && h.papan[0].quiz === 1);
  ok('Jumlah lulus ikut terhitung', h.papan.find(p => p.aku)?.lulus === 1);
  ok('Flag pindah-tab ikut terhitung', h.papan.find(p => p.aku)?.flags === 2);
}

console.log('\n10. Tanpa data apa pun: papan berisi SATU baris "belum dinilai"');
{
  /*
    Pengujian ini dulu berbunyi `h.papan.length === 0` dan karena itu MERAH
    permanen - bertentangan dengan perilaku yang justru sengaja dibangun di
    hitungPeringkat: pemanggil yang belum punya nilai tetap diberi barisnya
    sendiri bertanda belumDinilai, supaya papannya tidak tampil berisi orang
    lain semua tanpa satu pun keterangan kenapa dirinya tidak ada di sana.

    Yang diperbaiki adalah HARAPANNYA, bukan kode produksinya. Pengujian yang
    merah terus-menerus lebih berbahaya daripada tidak ada pengujian sama
    sekali: ia melatih orang mengabaikan kegagalan, termasuk yang sungguhan.
  */
  const h = hitungPeringkat([], { id: 'u1', role: 'guest', sales_division: null });
  ok('Papan berupa array, bukan undefined', Array.isArray(h.papan));
  sama('Tepat satu baris - milik pemanggil sendiri', h.papan.length, 1);
  ok('Baris itu ditandai belum dinilai', h.papan[0]?.belumDinilai === true);
  ok('Tidak mengarang peringkat', h.globalRank === null && h.papan[0]?.rank === 0);
}

/*
  11-13. ATURAN URUTAN - ini yang selama ini memicu komplain "peringkat saya
  pindah sendiri". Ketiganya menguji hal yang sama dari tiga sisi: hasil
  untuk data yang sama harus SELALU identik, apa pun urutan baris masuknya.
*/
console.log('\n11. Skor seri -> waktu pengerjaan tercepat menang');
{
  const rows: BarisAttempt[] = [
    { user_id: 'lambat', score: 100, grading_status: null, role: 'guest', sales_division: 'Jakarta', full_name: 'Lambat', time_taken_sec: 1800 },
    { user_id: 'cepat',  score: 100, grading_status: null, role: 'guest', sales_division: 'Jakarta', full_name: 'Cepat',  time_taken_sec: 600 },
  ];
  const h = hitungPeringkat(rows, { id: 'cepat', role: 'guest', sales_division: 'Jakarta' });
  sama('Yang lebih cepat dapat peringkat 1', h.globalRank, 1);
  ok('Waktu ikut dikirim ke papan supaya alasannya terlihat di layar',
    h.papan.find(p => p.aku)?.avgWaktu === 600);
}

console.log('\n12. Skor DAN waktu sama persis -> peringkat kembar, bukan diacak');
{
  const kembar = (id: string): BarisAttempt => ({
    user_id: id, score: 90, grading_status: null, role: 'guest',
    sales_division: 'Jakarta', full_name: id, time_taken_sec: 900,
  });
  const rows = [
    kembar('a'), kembar('b'),
    { ...kembar('c'), score: 95, time_taken_sec: 500 } as BarisAttempt,
  ];
  const h = hitungPeringkat(rows, { id: 'a', role: 'guest', sales_division: 'Jakarta' });
  sama('Nomor peringkat papan: 1, 2, 2 (yang seri kembar)', h.papan.map(p => p.rank), [1, 2, 2]);
  sama('Pemanggil yang seri tetap dapat nomor peringkat yang sama', h.globalRank, 2);
}

console.log('\n13. Urutan baris masukan tidak mengubah hasil (stabil antar reload)');
{
  const buat = (id: string): BarisAttempt => ({
    user_id: id, score: 88, grading_status: null, role: 'guest',
    sales_division: 'Jakarta', full_name: id, time_taken_sec: 1200,
  });
  //  Semua peserta seri SEMPURNA - inilah kasus yang dulu urutannya
  //  ditentukan urutan baris apa adanya dari database, dan karena itu bisa
  //  berubah antar permintaan tanpa ada satu pun data yang berubah.
  const maju  = ['u1', 'u2', 'u3', 'u4'].map(buat);
  const mundur = [...maju].reverse();
  const h1 = hitungPeringkat(maju,  { id: 'u3', role: 'guest', sales_division: 'Jakarta' });
  const h2 = hitungPeringkat(mundur, { id: 'u3', role: 'guest', sales_division: 'Jakarta' });
  sama('Peringkat pemanggil identik walau urutan baris dibalik', h1.globalRank, h2.globalRank);
  ok('Seluruh papan identik walau urutan baris dibalik',
    JSON.stringify(h1.papan) === JSON.stringify(h2.papan));
  sama('Semua seri sempurna -> semua dapat nomor 1', h1.papan.map(p => p.rank), [1, 1, 1, 1]);
}

console.log('\n14. Peringkat PER SESI tidak digeser oleh sesi lain');
{
  const att = (
    attempt_id: string, quiz_session_id: string, user_id: string, score: number, time_taken_sec: number,
  ): BarisAttempt => ({
    attempt_id, quiz_session_id, user_id, score, time_taken_sec,
    grading_status: null, role: 'guest', sales_division: 'Jakarta', full_name: user_id,
  });

  //  Sesi A: aku juara 1. Sesi B (yang TIDAK aku ikuti) dipakai untuk
  //  membuktikan angkanya tidak ikut berubah gara-gara sesi lain berjalan.
  const sesiA = [
    att('a-aku', 'A', 'aku', 100, 600),
    att('a-x',   'A', 'x',   90,  500),
    att('a-y',   'A', 'y',   80,  400),
  ];
  const sesiB = [
    att('b-x', 'B', 'x', 100, 100),
    att('b-y', 'B', 'y', 100, 120),
    att('b-z', 'B', 'z', 100, 130),
  ];
  const aku = { id: 'aku', role: 'guest', sales_division: 'Jakarta' };

  const sebelum = hitungPeringkat(sesiA, aku);
  const sesudah = hitungPeringkat([...sesiA, ...sesiB], aku);

  sama('Sesi A: aku juara 1 dari 3', sebelum.peringkatSesi['a-aku'], { rank: 1, total: 3 });
  sama('Setelah sesi B berjalan, peringkat sesi A TIDAK berubah',
    sesudah.peringkatSesi['a-aku'], { rank: 1, total: 3 });
  ok('Peringkat GLOBAL memang bergeser oleh sesi B - itu sebabnya angka per sesi dibutuhkan',
    sebelum.globalRank !== sesudah.globalRank,
    `global ${sebelum.globalRank} -> ${sesudah.globalRank}`);
  ok('Hanya attempt milik pemanggil yang dikembalikan',
    Object.keys(sesudah.peringkatSesi).every(k => k.startsWith('a-aku')));
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
