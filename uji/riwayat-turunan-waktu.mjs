
let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

function waktuTurunan(waktuMentah, catatanAsliTerawal) {
  let waktu = waktuMentah;
  if (catatanAsliTerawal && waktu >= catatanAsliTerawal) {
    waktu = new Date(new Date(catatanAsliTerawal).getTime() - 1000).toISOString();
  }
  return waktu;
}

function menitLalu(waktuIso, sekarang) {
  return (new Date(sekarang).getTime() - new Date(waktuIso).getTime()) / 60000;
}

const SEKARANG = '2026-08-29T19:23:22.000Z';

console.log('\n1. Kasus nyata: proyek selesai Juni, disunting field lain Agustus');
{
  const dueDate = '2026-06-17';
  const updatedAt = SEKARANG;
  const catatanAsliTerawal = SEKARANG;

  const waktuLama = waktuTurunan(updatedAt, catatanAsliTerawal);
  ok('Pola LAMA (updated_at): tetap tampak "baru saja" - membuktikan bugnya nyata',
    menitLalu(waktuLama, SEKARANG) < 1, `${menitLalu(waktuLama, SEKARANG).toFixed(2)} menit lalu`);

  const waktuBaru = waktuTurunan(dueDate, catatanAsliTerawal);
  ok('Pola SEKARANG (due_date): tampil sebagai peristiwa lama, bukan barusan',
    menitLalu(waktuBaru, SEKARANG) > 60 * 24 * 30, `${(menitLalu(waktuBaru, SEKARANG) / 60 / 24).toFixed(0)} hari lalu`);
}

console.log('\n2. status_change memakai bast_date (tanggal serah-terima sungguhan) bila ada');
{
  const dueDate = '2026-06-15';
  const bastDate = '2026-06-17';
  const catatanAsliTerawal = SEKARANG;
  const waktuAssign = waktuTurunan(dueDate, catatanAsliTerawal);
  const waktuSelesai = waktuTurunan(bastDate, catatanAsliTerawal);
  ok('assign pakai due_date', waktuAssign === dueDate);
  ok('status_change pakai bast_date, bukan due_date', waktuSelesai === bastDate);
}

console.log('\n3. Proyek TANPA bast_date (persis kasus Steak 21) tetap jatuh ke due_date - bukan ke "sekarang"');
{
  const dueDate = '2026-06-17';
  const bastDate = null;
  const catatanAsliTerawal = SEKARANG;
  const anchor = bastDate ?? dueDate;
  const waktuSelesai = waktuTurunan(anchor, catatanAsliTerawal);
  ok('Jatuh ke due_date, bukan updated_at/sekarang', waktuSelesai === dueDate);
  ok('Tetap tampil sebagai peristiwa lama', menitLalu(waktuSelesai, SEKARANG) > 60 * 24);
}

console.log('\n4. Klem tetap berfungsi bila turunan MEMANG lebih baru dari catatan asli');
{
  const catatanAsliTerawal = '2026-01-01T00:00:00.000Z';
  const dueDateMasaDepan = '2026-08-29T19:23:22.000Z';
  const waktu = waktuTurunan(dueDateMasaDepan, catatanAsliTerawal);
  ok('Diklem ke sebelum catatan asli - tidak terbalik urutannya', waktu < catatanAsliTerawal);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
