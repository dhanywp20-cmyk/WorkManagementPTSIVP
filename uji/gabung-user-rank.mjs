/*
  UJI: pola gabung-di-JS yang dipakai /api/learning-center/rank/route.ts
  (dua kueri terpisah - lc_quiz_attempts dan users - digabung lewat Map),
  BUKAN embed PostgREST `lc_quiz_attempts.select('*, users(role, ...)')`.

  Bug nyata: Hendri Saputra (role guest, 1 attempt score 80, sudah dinilai)
  tampil benar di Top Performers Admin (yang MEMANG sudah memakai pola
  gabung-di-JS ini, lihat AdminDashboard.tsx) tapi peringkatnya sendiri di
  /api/learning-center/rank selalu kosong ("—"), padahal quiz-stat mentahnya
  (query langsung ke lc_quiz_attempts miliknya sendiri) tampil benar.

  Akar masalahnya: route.ts sebelumnya memakai embed
  `.select('user_id, score, grading_status, users(role, sales_division)')`.
  Embed itu bergantung pada PostgREST BERHASIL mengenali relasi FK
  lc_quiz_attempts.user_id -> users.id. Di basis data ini relasi itu tidak
  selalu terbaca (ada kolom yang cuma uuid/text tanpa constraint sungguhan -
  lihat sql/kunci-tabel-lanjutan-2.sql). Saat embed gagal, PostgREST TIDAK
  melempar error - ia mengembalikan `users: null` untuk SETIAP baris tanpa
  terkecuali, lalu hitungPeringkat() membuang baris itu lewat `!a.role`,
  dan SELURUH orang (bukan cuma Hendri) kehilangan peringkatnya - AdminDashboard
  sudah pernah menabrak masalah identik ("SELURUH tab jadi kosong - tanpa
  error"), dan meninggalkan komentar persis tentang ini.

  Uji ini membuktikan pola pengganti (Map join di JS) TIDAK punya kegagalan
  serentak seperti itu: satu baris tanpa padanan user tetap null SENDIRIAN,
  baris lain yang padanannya ADA tetap terisi benar.

    node uji/gabung-user-rank.mjs
*/

let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

/** Meniru persis pola di route.ts sesudah perbaikan. */
function gabungkan(attempts, users) {
  const petaUser = new Map();
  for (const u of users) petaUser.set(u.id, { role: u.role, sales_division: u.sales_division });

  return attempts.map(a => {
    const u = petaUser.get(a.user_id);
    return {
      user_id: a.user_id, score: a.score, grading_status: a.grading_status,
      role: u?.role ?? null, sales_division: u?.sales_division ?? null,
    };
  });
}

console.log('\n1. Kasus nyata: Hendri (guest, score 80, sudah dinilai) harus tetap punya role');
{
  const attempts = [
    { user_id: 'hendri-id', score: 80, grading_status: 'graded' },
    { user_id: 'lain-id',   score: 93, grading_status: 'graded' },
  ];
  const users = [
    { id: 'hendri-id', role: 'guest', sales_division: null },
    { id: 'lain-id',   role: 'sales', sales_division: 'Jakarta' },
  ];
  const hasil = gabungkan(attempts, users);
  const hendri = hasil.find(r => r.user_id === 'hendri-id');
  ok('Hendri tetap punya role "guest" (bukan null)', hendri.role === 'guest');
  ok('Hendri tetap punya score 80', hendri.score === 80);
}

console.log('\n2. Satu attempt tanpa padanan di tabel users - HANYA baris itu yang null, bukan semua');
{
  const attempts = [
    { user_id: 'hendri-id', score: 80, grading_status: 'graded' },
    { user_id: 'yatim-id',  score: 50, grading_status: 'graded' }, // user_id tak ditemukan
    { user_id: 'lain-id',   score: 93, grading_status: 'graded' },
  ];
  const users = [
    { id: 'hendri-id', role: 'guest', sales_division: null },
    { id: 'lain-id',   role: 'sales', sales_division: 'Jakarta' },
  ];
  const hasil = gabungkan(attempts, users);
  ok('Baris yatim role-nya null (dibuang wajar oleh hitungPeringkat)',
    hasil.find(r => r.user_id === 'yatim-id').role === null);
  ok('Hendri TETAP terisi - bukan ikut null karena satu baris lain bermasalah',
    hasil.find(r => r.user_id === 'hendri-id').role === 'guest');
  ok('Peserta lain TETAP terisi',
    hasil.find(r => r.user_id === 'lain-id').role === 'sales');
}

console.log('\n3. Kontras: pola embed LAMA gagal SERENTAK untuk semua baris');
{
  // Simulasi persis apa yang dikatakan PostgREST saat FK tidak terbaca:
  // SETIAP baris kembali dengan users: null, bukan cuma yang tak match.
  const rowsDariEmbedGagal = [
    { user_id: 'hendri-id', score: 80, grading_status: 'graded', users: null },
    { user_id: 'lain-id',   score: 93, grading_status: 'graded', users: null },
  ];
  const hasilLama = rowsDariEmbedGagal.map(a => ({
    user_id: a.user_id, score: a.score, grading_status: a.grading_status,
    role: a.users?.role ?? null, sales_division: a.users?.sales_division ?? null,
  }));
  ok('Pola LAMA: Hendri ikut kena null walau usernya sungguhan ada',
    hasilLama.find(r => r.user_id === 'hendri-id').role === null);
  ok('Pola LAMA: SEMUA baris null bersamaan - bukan cuma satu yang bermasalah',
    hasilLama.every(r => r.role === null));
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
