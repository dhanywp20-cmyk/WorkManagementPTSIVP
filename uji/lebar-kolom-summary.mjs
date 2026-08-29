/*
  UJI: lebar kolom Tabel 1 (daftar proyek) tidak boleh ditimpa oleh Tabel 2
  (rekapitulasi per orang) di rekap Summary Incentive.

  Bug nyata dari laporan pengguna: kolom Nominal tampil "########" dan kolom
  PIC/Support/Supervisor/Manager begitu sempit sampai teksnya tumpang tindih
  ke baris berikutnya ("ketumpuk"). Sebabnya kedua tabel berbagi grid kolom
  yang sama (kolom 1-10), dan kode Tabel 2 menulis `.width = angka` yang jauh
  lebih kecil (8/16) daripada kebutuhan Tabel 1 (18-24) - MENIMPA, bukan
  menambah di sebelahnya.

  Uji ini membuktikan lewat file .xlsx SUNGGUHAN (ditulis lalu dibaca ulang):
  pola lama (assignment langsung) memang menghasilkan kolom yang menyusut;
  pola sekarang (`perbesarKolom`, hanya boleh melebarkan lewat Math.max)
  tidak. Angka lebar yang dipakai di sini disalin persis dari
  app/incentive-pts/_components/exportPengajuan.ts supaya uji ini benar-benar
  mewakili kode produksinya, bukan angka karangan.

    node uji/lebar-kolom-summary.mjs
*/
import ExcelJS from 'exceljs';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Lebar Tabel 1 - disalin dari COLS di exportSummaryIncentive.
const LEBAR_TABEL1 = { 1: 5, 2: 38, 3: 10, 4: 13, 5: 18, 6: 24, 7: 24, 8: 24, 9: 24, 10: 24 };

async function bangunDanBaca(terapkanLebarTabel2) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Test');

  for (const [kolom, lebar] of Object.entries(LEBAR_TABEL1)) {
    ws.getColumn(Number(kolom)).width = lebar;
  }

  // Tabel 2: 3 tahun pencairan -> kolom 3..8 (pasangan %/amount) + kolom 9 (Total).
  terapkanLebarTabel2(ws, { mulai: 3, jumlahTahun: 3 });

  const file = path.join(os.tmpdir(), `uji-lebar-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await wb.xlsx.writeFile(file);
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(file);
  fs.unlinkSync(file);
  return wb2.getWorksheet('Test');
}

let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

console.log('\n1. Pola LAMA (assignment langsung) - membuktikan bug-nya nyata');
{
  const ws = await bangunDanBaca((ws2, { mulai, jumlahTahun }) => {
    let kh = mulai;
    for (let i = 0; i < jumlahTahun; i++) {
      ws2.getColumn(kh).width = 8;
      ws2.getColumn(kh + 1).width = 16;
      kh += 2;
    }
    ws2.getColumn(kh).width = 18; // kolom Total
  });
  ok('Kolom Nominal (5) MENYUSUT ke 8 - inilah sebab "########"', ws.getColumn(5).width === 8);
  ok('Kolom PIC (6) MENYUSUT ke 16, bukan 24', ws.getColumn(6).width === 16);
  ok('Kolom Support (7) MENYUSUT ke 8', ws.getColumn(7).width === 8);
}

console.log('\n2. Pola SEKARANG (perbesarKolom - hanya boleh melebarkan)');
{
  function perbesarKolom(ws2, kolom, minimal) {
    const c = ws2.getColumn(kolom);
    c.width = Math.max(c.width ?? 0, minimal);
  }
  const ws = await bangunDanBaca((ws2, { mulai, jumlahTahun }) => {
    let kh = mulai;
    for (let i = 0; i < jumlahTahun; i++) {
      perbesarKolom(ws2, kh, 8);
      perbesarKolom(ws2, kh + 1, 16);
      kh += 2;
    }
    perbesarKolom(ws2, kh, 18);
  });
  ok('Kolom Mode (3) tidak menyusut', ws.getColumn(3).width >= 10);
  ok('Kolom BAST (4) tidak menyusut', ws.getColumn(4).width >= 13);
  ok('Kolom Nominal (5) TETAP 18 - tidak lagi "########"', ws.getColumn(5).width >= 18);
  ok('Kolom PIC (6) tetap 24', ws.getColumn(6).width >= 24);
  ok('Kolom Support (7) tetap 24 - tidak lagi tumpang tindih', ws.getColumn(7).width >= 24);
  ok('Kolom Supervisor (8) tetap 24', ws.getColumn(8).width >= 24);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
