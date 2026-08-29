/*
  UJI: sel SUM() di rekap Excel harus membawa hasilnya sendiri.

  Bug nyata: baris TOTAL dan GRAND TOTAL di rekap Incentive tampil kosong.
  Sebabnya ExcelJS menulis `{ formula: 'SUM(...)' }` TANPA nilai cache -
  sah menurut format .xlsx (Excel/Google Sheets menghitung ulang saat file
  dibuka), tapi banyak pembaca .xlsx ringan (pratinjau file manager, viewer
  di aplikasi chat, sebagian aplikasi mobile) hanya menampilkan cache-nya apa
  adanya tanpa menjalankan mesin formula - dan cache yang kosong tampil
  sebagai sel kosong.

  Uji ini membuktikan dengan file .xlsx SUNGGUHAN (ditulis lalu dibaca
  ulang - bukan cuma memeriksa objek JS di memori) bahwa pola lama memang
  menghasilkan cache kosong, dan pola yang dipakai sekarang (formula + result)
  tidak.

    node uji/sum-cell-xlsx.mjs
*/
import ExcelJS from 'exceljs';
import fs from 'fs';
import os from 'os';
import path from 'path';

function sumCell(formula, result) { return { formula, result }; }

let lulus = 0, gagal = 0;
function ok(nama, syarat) {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}`); }
}

async function tulisBacaUlang(nilaiSel) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Test');
  ws.getCell(1, 1).value = 100;
  ws.getCell(2, 1).value = 200;
  ws.getCell(3, 1).value = nilaiSel;
  const file = path.join(os.tmpdir(), `uji-sumcell-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await wb.xlsx.writeFile(file);
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(file);
  const cell = wb2.getWorksheet('Test').getCell(3, 1);
  fs.unlinkSync(file);
  return cell;
}

console.log('\n1. Pola LAMA (formula tanpa result) - membuktikan bug-nya nyata');
{
  const cell = await tulisBacaUlang({ formula: 'SUM(A1:A2)' });
  ok('Cache result KOSONG - inilah sebab TOTAL tampak blank', cell.result === undefined);
}

console.log('\n2. Pola SEKARANG (sumCell: formula + result)');
{
  const cell = await tulisBacaUlang(sumCell('SUM(A1:A2)', 300));
  ok('Formula tetap tersimpan, bisa diperiksa manual', cell.formula === 'SUM(A1:A2)');
  ok('Cache result TERISI - viewer ringan langsung menampilkan angkanya', cell.result === 300);
}

console.log('\n3. Angka besar & nol tetap membawa cache dengan benar');
{
  const besar = await tulisBacaUlang(sumCell('SUM(A1:A2)', 8_300_001));
  ok('Angka besar (Rp 8.300.001) tersimpan utuh', besar.result === 8_300_001);

  const nol = await tulisBacaUlang(sumCell('SUM(A1:A2)', 0));
  //  0 itu falsy - kalau kode menulis `hasil || undefined` alih-alih
  //  `hasil` apa adanya, GRAND TOTAL yang kebetulan nol akan balik kosong lagi.
  ok('Total nol TETAP tercatat sebagai 0, bukan kosong lagi', nol.result === 0);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
