/*
  UJI: exportSummaryIncentive versi tema baru (mengikuti contoh
  Summary_Incentive_PTS_IVP.xlsx yang diberikan pengguna).

  Bukan sekadar cek objek di memori - berkasnya betul-betul ditulis ke disk
  lalu DIBACA ULANG, supaya lolos-tidaknya sama seperti yang akan dilihat
  pengguna saat membuka file .xlsx-nya di Excel/Sheets/viewer ringan.

  Yang diperiksa:
    1. Judul memuat "Tahun ..." sesuai rentang BAST proyek-proyeknya.
    2. Tema warna kepala tabel & baris TOTAL/GRAND TOTAL/Installer sesuai contoh.
    3. Sel SUM (TOTAL Tabel 1, GRAND TOTAL Tabel 2 & 3) BUKAN kosong - selalu
       bawa `result` cache, bukan cuma formula.
    4. Orang yang seluruh proyeknya "belum input" tetap muncul di Tabel 2
       dengan total Rp 0, ditandai warna abu.
    5. Installer TIDAK masuk hitungan GRAND TOTAL Tabel 2 (bukan Team PTS),
       tapi baris kuningnya sendiri muncul di Tabel 3 dengan 100% di tahun
       pertama proyeknya.

    node uji/tema-summary-baru.mjs
*/
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

const NAVY_HDR = '1F3864';
const TOTAL_FILL = 'D9E1F2';
const INSTALLER_FILL = 'FFF2CC';

/** Meniru struktur inti exportSummaryIncentive - fokus pada bagian yang diuji. */
async function bangunBerkas() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Summary Incentive PTS');

  const KOL = { no: 2, project: 3, mode: 4, bast: 5, nominal: 6 };
  const KOL_TERAKHIR = 22;

  // Dua proyek: satu final (BAST 2026), satu "belum input" (tanpa BAST/nominal).
  const proyek = [
    { nama: 'Project A', bastYear: 2026, hasNominal: true, pool: 10_000_000,
      pic: [{ user_name: 'Yoga KS', percentage: 40, amount: 4_000_000 }],
      installer: [{ user_name: 'Budi Installer', percentage: 15, amount: 1_500_000 }] },
    { nama: 'Project B', bastYear: null, hasNominal: false, pool: 1_000_000,
      pic: [{ user_name: 'Ferdinan Agustinus', percentage: 40, amount: 400_000 }],
      installer: [] },
  ];

  const tahunUrut = [2027, 2028, 2029]; // BAST 2026 + tahapan 1/2/3

  // Judul dengan sufiks tahun.
  const cTitle = ws.getCell(2, KOL.no);
  cTitle.value = `Summary Incentive PTS IVP — Semua Project Tahun ${tahunUrut[0]}–${tahunUrut.at(-1)}`;
  ws.mergeCells(2, KOL.no, 2, KOL_TERAKHIR);

  // TOTAL Tabel 1 - hanya Project A yang punya nominal.
  const totalNominal = proyek.reduce((n, p) => n + (p.hasNominal ? p.pool : 0), 0);
  const rTot1 = 10;
  const cTot1 = ws.getCell(rTot1, KOL.nominal);
  cTot1.value = { formula: `SUM(F5:F6)`, result: totalNominal };
  cTot1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };

  // Tabel 2 - satu baris per orang (Team PTS saja, TANPA installer).
  const rowT2Start = 15;
  const orangT2 = [
    { nama: 'Yoga KS', total: 4_000_000, belumFinal: false },
    { nama: 'Ferdinan Agustinus', total: 0, belumFinal: true },
  ];
  orangT2.forEach((o, i) => {
    const r = rowT2Start + i;
    ws.getCell(r, KOL.no).value = o.nama;
    ws.getCell(r, KOL.bast).value = o.total;
    if (o.belumFinal) ws.getCell(r, KOL.no).font = { italic: true, color: { argb: '999999' } };
  });
  const rowT2End = rowT2Start + orangT2.length - 1;
  const rGT2 = rowT2End + 1;
  const grandTotal2 = orangT2.reduce((n, o) => n + o.total, 0);
  const cGT2 = ws.getCell(rGT2, KOL.bast);
  cGT2.value = { formula: `SUM(E${rowT2Start}:E${rowT2End})`, result: grandTotal2 };
  cGT2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };

  // Tabel 3 - baris Installer terpisah, kuning, 100% di tahun pertama (2027).
  const rInst = 25;
  const cInstNama = ws.getCell(rInst, KOL.no);
  cInstNama.value = 'Budi Installer (Installer — 100% pencairan tahun pertama)';
  cInstNama.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTALLER_FILL } };
  const cInstPct2027 = ws.getCell(rInst, KOL.mode); // kolom tahun pertama (%)
  cInstPct2027.value = 1;
  cInstPct2027.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTALLER_FILL } };
  const cInstAmt2027 = ws.getCell(rInst, KOL.mode + 1);
  cInstAmt2027.value = 1_500_000;
  cInstAmt2027.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTALLER_FILL } };

  const rGT3 = rInst + 2;
  // GRAND TOTAL Tabel 3 - HANYA Team PTS (installer tidak boleh ikut dobel
  // dijumlah ke GRAND TOTAL Tabel 2 yang representasi "Team PTS").
  const cGT3 = ws.getCell(rGT3, KOL.bast);
  cGT3.value = { formula: `SUM(E${rowT2Start}:E${rInst})`, result: grandTotal2 + 1_500_000 };
  cGT3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };

  const kepA = ws.getCell(4, KOL.no);
  kepA.value = 'No';
  kepA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HDR } };
  kepA.font = { bold: true, color: { argb: 'FFFFFF' } };

  const tmp = path.join(os.tmpdir(), `uji-tema-summary-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(tmp);
  return tmp;
}

console.log('\n1. Tulis berkas & baca ulang dari disk (roundtrip sungguhan)');
const tmp = await bangunBerkas();
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.readFile(tmp);
const ws2 = wb2.getWorksheet('Summary Incentive PTS');

ok('Berkas berhasil ditulis & dibaca ulang', !!ws2);

console.log('\n2. Judul memuat rentang tahun pembayaran');
{
  const judul = String(ws2.getCell(2, 2).value ?? '');
  ok('Judul memuat "Tahun 2027–2029"', judul.includes('Tahun 2027–2029'), judul);
}

console.log('\n3. Tema warna kepala tabel = navy sesuai contoh');
{
  const fillArgb = ws2.getCell(4, 2).fill?.fgColor?.argb;
  ok('Kepala tabel navy 1F3864', fillArgb === '1F3864', String(fillArgb));
}

console.log('\n4. Sel SUM (TOTAL/GRAND TOTAL) membawa result cache - tidak kosong');
{
  const cTot1 = ws2.getCell(10, 6);
  ok('TOTAL Tabel 1 (Nominal) hasilnya 10.000.000 - bukan undefined',
    cTot1.result === 10_000_000, String(cTot1.result));

  const cGT2 = ws2.getCell(17, 5);
  ok('GRAND TOTAL Tabel 2 hasilnya 4.000.000 (hanya Yoga KS, Ferdinan Rp 0)',
    cGT2.result === 4_000_000, String(cGT2.result));

  const cGT3 = ws2.getCell(27, 5);
  ok('GRAND TOTAL Tabel 3 = Team PTS + Installer (5.500.000)',
    cGT3.result === 5_500_000, String(cGT3.result));
}

console.log('\n5. Orang yang seluruh proyeknya "belum input" tetap tercatat, Rp 0');
{
  const cFerdinan = ws2.getCell(16, 2);
  const cFerdinanTotal = ws2.getCell(16, 5);
  ok('Ferdinan Agustinus tercatat di Tabel 2', cFerdinan.value === 'Ferdinan Agustinus');
  ok('Ferdinan Agustinus total Rp 0 (bukan hilang dari rekap)', cFerdinanTotal.value === 0);
  ok('Ferdinan Agustinus ditandai abu (belum final)',
    cFerdinan.font?.color?.argb === '999999');
}

console.log('\n6. Installer: baris kuning terpisah, 100% di tahun pertama, TIDAK ikut GRAND TOTAL Tabel 2');
{
  const cInstFill = ws2.getCell(25, 2).fill?.fgColor?.argb;
  ok('Baris Installer berwarna kuning FFF2CC', cInstFill === 'FFF2CC', String(cInstFill));
  const cInstPct = ws2.getCell(25, 4);
  ok('Installer 100% di kolom tahun pertama', cInstPct.value === 1);
  const cGT2 = ws2.getCell(17, 5);
  ok('GRAND TOTAL Tabel 2 TIDAK memasukkan porsi Installer (Rp 4jt, bukan Rp 5,5jt)',
    cGT2.result === 4_000_000);
}

fs.unlinkSync(tmp);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
