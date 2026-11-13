'use client';

import type { BarisInstaller, BarisRedistribusi } from './exportPengajuan-data';
import ExcelJS from 'exceljs';
import { INSTALLER_FILL, KOL, KOL_REKAP, NAVY_HDR, RUPIAH_FMT, SUB_HDR, TOTAL_FILL, dataFont, fillWarna, perbesarKolom, putih, selGabung, sumCell, thinBorder } from './exportPengajuan-gaya';
import { getColLetter } from './exportPengajuan';
const REDISTRIBUSI_FILL = 'FCE7F3';

export interface KonteksTulisTabelPengajuanTahunan {
  ws: ExcelJS.Worksheet;
  row: number;
  KOL_TERAKHIR: number;
  KOL_TAHUN_AWAL: number;
  tahunUrut: number[];
  kolTotal3: number;
  orangUrut: { nama: string; peran: Set<string>; total: number; jumlah: number; }[];
  namaBelumFinal: Set<string>;
  urutPeran: Record<string, number>;
  roleLabel: (r: string) => "PIC" | "Support" | "Supervisor" | "Manager";
  perOrangTahun: Map<string, Map<number, number>>;
  installerList: BarisInstaller[];
  redistribusiList: BarisRedistribusi[];
}

export function tulisTabelPengajuanTahunan(k: KonteksTulisTabelPengajuanTahunan) {
  const { ws, KOL_TERAKHIR, KOL_TAHUN_AWAL, tahunUrut, kolTotal3, orangUrut, namaBelumFinal, urutPeran,
    roleLabel, perOrangTahun, installerList, redistribusiList } = k;
  let { row } = k;
  const cJudul3 = ws.getCell(row, KOL.no);
  cJudul3.value = '3. Nilai Pengajuan Incentive per Tahun';
  cJudul3.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const k3A = row, k3B = row + 1;
  const cNamaH = ws.getCell(k3A, KOL_REKAP.nama[0]); cNamaH.value = 'Nama'; cNamaH.font = putih(); cNamaH.fill = fillWarna(NAVY_HDR);
  cNamaH.alignment = { horizontal: 'center', vertical: 'middle' }; cNamaH.border = thinBorder();
  for (let k = KOL_REKAP.nama[0]; k <= KOL_REKAP.nama[1]; k++) {
    const x = ws.getCell(k3A, k); x.fill = fillWarna(NAVY_HDR); x.border = thinBorder();
    const y = ws.getCell(k3B, k); y.fill = fillWarna(NAVY_HDR); y.border = thinBorder();
  }
  ws.mergeCells(k3A, KOL_REKAP.nama[0], k3B, KOL_REKAP.nama[1]);
  for (let k = KOL_REKAP.peran[0]; k <= KOL_REKAP.peran[1]; k++) {
    const x = ws.getCell(k3A, k); x.fill = fillWarna(NAVY_HDR); x.border = thinBorder();
    const y = ws.getCell(k3B, k); y.fill = fillWarna(NAVY_HDR); y.border = thinBorder();
  }
  const cPeranH = ws.getCell(k3A, KOL_REKAP.peran[0]);
  cPeranH.value = 'Peran'; cPeranH.font = putih();
  cPeranH.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(k3A, KOL_REKAP.peran[0], k3B, KOL_REKAP.peran[1]);

  let kh = KOL_TAHUN_AWAL;
  for (const th of tahunUrut) {
    const c = ws.getCell(k3A, kh);
    c.value = `dibayarkan tahun ${th}`; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = thinBorder();
    ws.mergeCells(k3A, kh, k3A, kh + 1);
    for (const [off, teks] of [[0, '%'], [1, 'amount']] as [number, string][]) {
      const s = ws.getCell(k3B, kh + off);
      s.value = teks; s.font = putih(); s.fill = fillWarna(SUB_HDR);
      s.alignment = { horizontal: 'center', vertical: 'middle' }; s.border = thinBorder();
    }
    perbesarKolom(ws, kh, 8); perbesarKolom(ws, kh + 1, 14);
    kh += 2;
  }
  const cTotH3 = ws.getCell(k3A, kolTotal3);
  cTotH3.value = 'Total'; cTotH3.font = putih(); cTotH3.fill = fillWarna(NAVY_HDR);
  cTotH3.alignment = { horizontal: 'center', vertical: 'middle' }; cTotH3.border = thinBorder();
  ws.mergeCells(k3A, kolTotal3, k3B, kolTotal3);
  perbesarKolom(ws, kolTotal3, 14);
  row = k3B + 1;
  const t3Awal = row;

  orangUrut.forEach(o => {
    const belumFinal = namaBelumFinal.has(o.nama);
    selGabung(ws, row, KOL_REKAP.nama, o.nama, {
      font: belumFinal ? { ...dataFont(), italic: true, color: { argb: '999999' } } : dataFont(),
    });
    selGabung(ws, row, KOL_REKAP.peran,
      [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9)).map(roleLabel).join(', '));

    const ember = perOrangTahun.get(o.nama);
    let kk = KOL_REKAP.peran[1] + 1;
    const kolomAmount: number[] = [];
    for (const th of tahunUrut) {
      const nilai = ember?.get(th) ?? 0;
      const cPct = ws.getCell(row, kk);
      cPct.value = nilai && o.total ? nilai / o.total : null;
      cPct.numFmt = '0.0%'; cPct.border = thinBorder(); cPct.font = dataFont(9);
      cPct.alignment = { horizontal: 'center', vertical: 'middle' };
      const cAmt = ws.getCell(row, kk + 1);
      cAmt.value = nilai || null;
      cAmt.numFmt = RUPIAH_FMT; cAmt.border = thinBorder(); cAmt.font = dataFont();
      cAmt.alignment = { horizontal: 'right', vertical: 'middle' };
      kolomAmount.push(kk + 1);
      kk += 2;
    }
    const cTot = ws.getCell(row, kolTotal3);
    const rumus = kolomAmount.map(c => `${getColLetter(c)}${row}`).join('+');
    cTot.value = kolomAmount.length ? sumCell(rumus, o.total) : o.total;
    cTot.numFmt = RUPIAH_FMT; cTot.font = { ...dataFont(), bold: true }; cTot.border = thinBorder();
    cTot.alignment = { horizontal: 'right', vertical: 'middle' };
    row += 1;
  });

  installerList.forEach(inst => {
    const r = row;
    selGabung(ws, r, KOL_REKAP.nama, `${inst.nama}${inst.lokasi ? ' · ' + inst.lokasi : '' }`,
      { isi: INSTALLER_FILL });
    selGabung(ws, r, KOL_REKAP.peran, 'PTS Daerah', { isi: INSTALLER_FILL });

    let kk = KOL_REKAP.peran[1] + 1; let kolAmt = -1;
    for (const th of tahunUrut) {
      const cPct = ws.getCell(r, kk); const cAmt = ws.getCell(r, kk + 1);
      cPct.fill = fillWarna(INSTALLER_FILL); cAmt.fill = fillWarna(INSTALLER_FILL);
      cPct.border = thinBorder(); cAmt.border = thinBorder();
      cPct.numFmt = '0.0%'; cAmt.numFmt = RUPIAH_FMT;
      cPct.alignment = { horizontal: 'center', vertical: 'middle' }; cAmt.alignment = { horizontal: 'right', vertical: 'middle' };
      cPct.font = dataFont(9); cAmt.font = dataFont();
      if (th === inst.tahun) { cPct.value = 1; cAmt.value = inst.jumlah; kolAmt = kk + 1; }
      kk += 2;
    }
    const cTot = ws.getCell(r, kolTotal3);
    cTot.value = kolAmt > 0 ? sumCell(`${getColLetter(kolAmt)}${r}`, inst.jumlah) : inst.jumlah;
    cTot.numFmt = RUPIAH_FMT; cTot.font = { ...dataFont(), bold: true }; cTot.fill = fillWarna(INSTALLER_FILL); cTot.border = thinBorder();
    cTot.alignment = { horizontal: 'right', vertical: 'middle' };
    row += 1;
  });
  redistribusiList.forEach(inst => {
    const r = row;
    selGabung(ws, r, KOL_REKAP.nama, `Redistribusi dari ${inst.dari} — ${inst.proyek} — Tahun ${inst.tahap}`,
      { isi: REDISTRIBUSI_FILL });
    selGabung(ws, r, KOL_REKAP.peran, 'Dibagi rata ke Tim PTS aktif', { isi: REDISTRIBUSI_FILL });

    let kk = KOL_REKAP.peran[1] + 1; let kolAmt = -1;
    for (const th of tahunUrut) {
      const cPct = ws.getCell(r, kk); const cAmt = ws.getCell(r, kk + 1);
      cPct.fill = fillWarna(REDISTRIBUSI_FILL); cAmt.fill = fillWarna(REDISTRIBUSI_FILL);
      cPct.border = thinBorder(); cAmt.border = thinBorder();
      cPct.numFmt = '0.0%'; cAmt.numFmt = RUPIAH_FMT;
      cPct.alignment = { horizontal: 'center', vertical: 'middle' }; cAmt.alignment = { horizontal: 'right', vertical: 'middle' };
      cPct.font = dataFont(9); cAmt.font = dataFont();
      if (th === inst.tahun) { cPct.value = 1; cAmt.value = inst.jumlah; kolAmt = kk + 1; }
      kk += 2;
    }
    const cTot = ws.getCell(r, kolTotal3);
    cTot.value = kolAmt > 0 ? sumCell(`${getColLetter(kolAmt)}${r}`, inst.jumlah) : inst.jumlah;
    cTot.numFmt = RUPIAH_FMT; cTot.font = { ...dataFont(), bold: true }; cTot.fill = fillWarna(REDISTRIBUSI_FILL); cTot.border = thinBorder();
    cTot.alignment = { horizontal: 'right', vertical: 'middle' };
    row += 1;
  });
  const t3Akhir = row - 1;

  if (orangUrut.length === 0 && installerList.length === 0 && redistribusiList.length === 0) {
    selGabung(ws, row, [KOL_REKAP.nama[0], kolTotal3], '(Belum ada project dengan nominal & mode final)',
      { font: { ...dataFont(), italic: true, color: { argb: '999999' } } });
    row += 1;
  }

  selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.peran[1]], 'GRAND TOTAL',
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  let kg = KOL_REKAP.peran[1] + 1;
  for (const _th of tahunUrut) {
    const cKosong = ws.getCell(row, kg); cKosong.fill = fillWarna(TOTAL_FILL); cKosong.border = thinBorder();
    const kolAmt = kg + 1;
    const huruf = getColLetter(kolAmt);
    const cJ = ws.getCell(row, kolAmt);
    let totalNilai = 0;
    for (let rr = t3Awal; rr <= t3Akhir; rr++) {
      const v = ws.getCell(rr, kolAmt).value;
      if (typeof v === 'number') totalNilai += v;
    }
    cJ.value = (t3Akhir >= t3Awal) ? sumCell(`SUM(${huruf}${t3Awal}:${huruf}${t3Akhir})`, totalNilai) : 0;
    cJ.numFmt = RUPIAH_FMT; cJ.font = { ...dataFont(), bold: true }; cJ.fill = fillWarna(TOTAL_FILL); cJ.border = thinBorder();
    cJ.alignment = { horizontal: 'right', vertical: 'middle' };
    kg += 2;
  }
  const hurufTot3 = getColLetter(kolTotal3);
  let grandTotal3 = 0;
  for (let rr = t3Awal; rr <= t3Akhir; rr++) {
    const v = ws.getCell(rr, kolTotal3).value;
    if (v && typeof v === 'object' && 'result' in (v as object)) grandTotal3 += (v as { result: number }).result;
    else if (typeof v === 'number') grandTotal3 += v;
  }
  const cGT3v = ws.getCell(row, kolTotal3);
  cGT3v.value = (t3Akhir >= t3Awal) ? sumCell(`SUM(${hurufTot3}${t3Awal}:${hurufTot3}${t3Akhir})`, grandTotal3) : 0;
  cGT3v.numFmt = RUPIAH_FMT; cGT3v.font = { ...dataFont(), bold: true }; cGT3v.fill = fillWarna(TOTAL_FILL); cGT3v.border = thinBorder();
  cGT3v.alignment = { horizontal: 'right', vertical: 'middle' };
  row += 1;

  selGabung(ws, row, [KOL_REKAP.nama[0], kolTotal3], 'Catatan: nilai Tahap 2 & 3 tiap proyek (tahun ke-2/ke-3 sejak BAST-nya '
    + 'masing-masing, bukan kolom ke-2/ke-3 di tabel ini) masih PROYEKSI - dihitung dari skema & Support yang terdeteksi saat '
    + 'berkas ini dibuat. Support baru yang terdeteksi sepanjang tahun tersebut bisa mengubah nominalnya. Export ulang menjelang '
    + 'akhir tahun bersangkutan untuk memastikan Support terbaru sudah ikut terhitung sebelum Process Batch dijalankan.',
    { font: { italic: true, size: 8, name: 'Arial', color: { argb: 'B45309' } } });
  ws.getRow(row).height = 24;
  return { row };
}
