
let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

function wakilProyek(baris) {
  return [...baris].sort((a, b) =>
    (b.due_date ?? '').localeCompare(a.due_date ?? '') || a.id.localeCompare(b.id))[0];
}

const jadwalTigaHari = () => ([
  { id: 'r1', batch_id: 'b1', due_date: '2026-06-15', bast_date: null },
  { id: 'r2', batch_id: 'b1', due_date: '2026-06-16', bast_date: null },
  { id: 'r3', batch_id: 'b1', due_date: '2026-06-17', bast_date: null },
]);

console.log('\n1. Cara LAMA (tulis ke satu baris yang dibuka) - membuktikan bugnya nyata');
{
  const baris = jadwalTigaHari();
  baris[0].bast_date = '2026-06-17';

  const wakil = wakilProyek(baris);
  ok('Wakil proyek adalah tanggal TERAKHIR (r3)', wakil.id === 'r3');
  ok('Wakil itu TIDAK punya BAST - inilah sebab "Belum diisi"', wakil.bast_date === null);
  ok('BAST-nya ada, tapi menempel di baris yang tidak dibaca siapa pun',
    baris.find(b => b.id === 'r1').bast_date === '2026-06-17');
}

console.log('\n2. Cara SEKARANG (tulis ke seluruh baris sebatch)');
{
  const baris = jadwalTigaHari();
  for (const b of baris) if (b.batch_id === 'b1') b.bast_date = '2026-06-17';

  const wakil = wakilProyek(baris);
  ok('Wakil proyek punya BAST', wakil.bast_date === '2026-06-17');
  ok('Semua baris membawa BAST yang sama', baris.every(b => b.bast_date === '2026-06-17'));
  ok('Tombol Generate Tahapan akan tampil (syaratnya cuma adanya BAST)', !!wakil.bast_date);
}

console.log('\n3. Jadwal satu hari tidak berubah perilakunya');
{
  const baris = [{ id: 'r9', batch_id: null, due_date: '2026-03-01', bast_date: null }];
  baris[0].bast_date = '2026-03-01';
  const wakil = wakilProyek(baris);
  ok('Tetap benar untuk jadwal tanpa batch', wakil.bast_date === '2026-03-01');
}

console.log('\n4. Batch lain tidak ikut tersentuh');
{
  const baris = [
    ...jadwalTigaHari(),
    { id: 'x1', batch_id: 'b2', due_date: '2026-06-20', bast_date: null },
  ];
  for (const b of baris) if (b.batch_id === 'b1') b.bast_date = '2026-06-17';
  ok('Jadwal batch lain tetap kosong', baris.find(b => b.id === 'x1').bast_date === null);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
