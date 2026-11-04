
let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

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
    { user_id: 'yatim-id',  score: 50, grading_status: 'graded' },
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
