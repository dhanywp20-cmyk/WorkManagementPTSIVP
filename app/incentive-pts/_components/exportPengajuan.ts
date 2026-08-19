'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  IncentiveProjectRow, IncentiveSplit, IncentiveTranche,
  SplitResult, formatRupiah, formatPct,
  calculateIncentiveSplits, findUpline, resolveUserId, OrgUser, ambilSkema,
} from './calc';

const NAVY = '1B3A6B';
const LIGHT_GRAY = 'F5F5F5';
const BORDER_COLOR = 'CCCCCC';

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } };
  return { top: side, bottom: side, left: side, right: side };
}

function headerFont(size = 10): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: 'FFFFFF' }, size, name: 'Arial' };
}

function headerFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
}

function dataFont(size = 10): Partial<ExcelJS.Font> {
  return { name: 'Arial', size };
}

interface ExportData {
  year: number;
  projects: IncentiveProjectRow[];
  splits: IncentiveSplit[];
  tranches: (IncentiveTranche & { project?: IncentiveProjectRow })[];
  managerName: string;
  directorName: string;
}

export async function exportPengajuanIncentive(data: ExportData) {
  const { year, projects, splits, tranches, managerName, directorName } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Pengajuan Incentive', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  let row = 1;

  // 1. Title
  const titleCell = ws.getCell(row, 1);
  titleCell.value = `Pengajuan Incentive Project-Project IVP Tahun ${year}`;
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, 1, row, 10);
  row += 2;

  const introCell = ws.getCell(row, 1);
  introCell.value = 'Saya yang bertanda tangan di bawah ini, ingin mengajukan pengeluaran Incentive Project-project yang telah diselesaikan oleh Team PTS IVP pada periode tahun tersebut, dengan rincian sebagai berikut:';
  introCell.font = dataFont(10);
  introCell.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(row, 1, row, 10);
  ws.getRow(row).height = 40;
  row += 2;

  // 2. Daftar Project
  const recipientMap = new Map<string, { user_id: string; user_name: string; role: string }>();
  for (const s of splits) {
    const key = `${s.user_id || s.user_name}_${s.role}`;
    if (!recipientMap.has(key)) {
      recipientMap.set(key, { user_id: s.user_id, user_name: s.user_name, role: s.role });
    }
  }
  const recipients = Array.from(recipientMap.values());

  const baseHeaders = ['No', 'Nama Project', 'User / Customer', 'Final Incentive (Rp)'];
  const totalCols = baseHeaders.length + recipients.length * 2 || 10;

  const groupHeaderRow = row;
  ws.getRow(groupHeaderRow).height = 25;

  for (let i = 0; i < baseHeaders.length; i++) {
    const cell = ws.getCell(groupHeaderRow, i + 1);
    cell.value = baseHeaders[i];
    cell.font = headerFont();
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
    ws.mergeCells(groupHeaderRow, i + 1, groupHeaderRow + 1, i + 1);
  }

  let colOffset = baseHeaders.length;
  for (const r of recipients) {
    const roleLabel = r.role === 'pic' ? 'PIC' : r.role === 'support' ? 'Support' : r.role === 'manager' ? 'Manager' : 'Installer';
    const mergeCell = ws.getCell(groupHeaderRow, colOffset + 1);
    mergeCell.value = `${r.user_name} (${roleLabel})`;
    mergeCell.font = headerFont();
    mergeCell.fill = headerFill();
    mergeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    mergeCell.border = thinBorder();
    ws.mergeCells(groupHeaderRow, colOffset + 1, groupHeaderRow, colOffset + 2);

    const pctCell = ws.getCell(groupHeaderRow + 1, colOffset + 1);
    pctCell.value = '%';
    pctCell.font = headerFont(9);
    pctCell.fill = headerFill();
    pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
    pctCell.border = thinBorder();

    const nomCell = ws.getCell(groupHeaderRow + 1, colOffset + 2);
    nomCell.value = 'Nominal';
    nomCell.font = headerFont(9);
    nomCell.fill = headerFill();
    nomCell.alignment = { horizontal: 'center', vertical: 'middle' };
    nomCell.border = thinBorder();

    colOffset += 2;
  }
  row += 2;

  const dataStartRow = row;
  projects.forEach((p, idx) => {
    const isAlt = idx % 2 === 1;
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };

    const noCell = ws.getCell(row, 1);
    noCell.value = idx + 1;
    noCell.font = dataFont();
    noCell.alignment = { horizontal: 'center', vertical: 'middle' };
    noCell.border = thinBorder();
    if (isAlt) noCell.fill = altFill;

    const nameCell = ws.getCell(row, 2);
    nameCell.value = p.project_name;
    nameCell.font = dataFont();
    nameCell.alignment = { vertical: 'middle', wrapText: true };
    nameCell.border = thinBorder();
    if (isAlt) nameCell.fill = altFill;

    const custCell = ws.getCell(row, 3);
    custCell.value = p.sales_name || '';
    custCell.font = dataFont();
    custCell.alignment = { vertical: 'middle' };
    custCell.border = thinBorder();
    if (isAlt) custCell.fill = altFill;

    const valCell = ws.getCell(row, 4);
    valCell.value = p.incentive_value || 0;
    valCell.numFmt = '#,##0';
    valCell.font = { ...dataFont(), bold: true };
    valCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valCell.border = thinBorder();
    if (isAlt) valCell.fill = altFill;

    let col = 5;
    for (const rec of recipients) {
      const split = splits.find(s =>
        s.project_id === p.id &&
        s.role === rec.role &&
        (s.user_id === rec.user_id || s.user_name === rec.user_name)
      );

      const pctCell = ws.getCell(row, col);
      pctCell.value = split ? split.percentage / 100 : 0;
      pctCell.numFmt = '0%';
      pctCell.font = dataFont();
      pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
      pctCell.border = thinBorder();
      if (isAlt) pctCell.fill = altFill;

      const amtCell = ws.getCell(row, col + 1);
      amtCell.value = split ? split.amount : 0;
      amtCell.numFmt = '#,##0';
      amtCell.font = dataFont();
      amtCell.alignment = { horizontal: 'right', vertical: 'middle' };
      amtCell.border = thinBorder();
      if (isAlt) amtCell.fill = altFill;

      col += 2;
    }
    row++;
  });
  const dataEndRow = row - 1;

  const totalRow = row;
  const totLabelCell = ws.getCell(totalRow, 1);
  totLabelCell.value = 'TOTAL';
  totLabelCell.font = { ...headerFont(11), color: { argb: '000000' } };
  totLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totLabelCell.border = thinBorder();
  totLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.mergeCells(totalRow, 1, totalRow, 3);

  const totValCell = ws.getCell(totalRow, 4);
  totValCell.value = { formula: `SUM(D${dataStartRow}:D${dataEndRow})` };
  totValCell.numFmt = '#,##0';
  totValCell.font = { ...dataFont(11), bold: true };
  totValCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totValCell.border = thinBorder();
  totValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  let sumCol = 5;
  for (const _rec of recipients) {
    const pctTot = ws.getCell(totalRow, sumCol);
    pctTot.border = thinBorder();
    pctTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const nomColLetter = getColLetter(sumCol + 1);
    const nomTot = ws.getCell(totalRow, sumCol + 1);
    nomTot.value = { formula: `SUM(${nomColLetter}${dataStartRow}:${nomColLetter}${dataEndRow})` };
    nomTot.numFmt = '#,##0';
    nomTot.font = { ...dataFont(11), bold: true };
    nomTot.alignment = { horizontal: 'right', vertical: 'middle' };
    nomTot.border = thinBorder();
    nomTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    sumCol += 2;
  }
  row += 2;

  // 3. Ringkasan per penerima
  const sectionTitle2 = ws.getCell(row, 1);
  sectionTitle2.value = 'Ringkasan Pencairan Per Penerima';
  sectionTitle2.font = { bold: true, size: 12, name: 'Arial' };
  sectionTitle2.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(row, 1, row, 6);
  row += 1;

  const trancheYears = [...new Set(tranches.map(t => t.payment_year))].filter(y => y === year).sort();
  const summaryHeaders = ['Nama'];
  for (const y of trancheYears) {
    summaryHeaders.push(`Tahun ${y} %`, `Tahun ${y} Nominal`);
  }
  summaryHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = headerFont();
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  });
  row++;

  const yearTranches = tranches.filter(t => t.payment_year === year);
  const yearTrancheIds = new Set(yearTranches.map(t => t.id));
  const yearSplits = splits.filter(s => s.tranche_id && yearTrancheIds.has(s.tranche_id));

  const userSummary = new Map<string, { name: string; totalPct: number; totalAmt: number }>();
  for (const s of yearSplits) {
    const key = s.user_name || s.user_id;
    const existing = userSummary.get(key) || { name: s.user_name, totalPct: 0, totalAmt: 0 };
    existing.totalPct += s.percentage;
    existing.totalAmt += s.amount;
    userSummary.set(key, existing);
  }

  for (const [, summary] of userSummary) {
    ws.getCell(row, 1).value = summary.name;
    ws.getCell(row, 1).font = dataFont();
    ws.getCell(row, 1).border = thinBorder();

    ws.getCell(row, 2).value = summary.totalPct / 100;
    ws.getCell(row, 2).numFmt = '0.0%';
    ws.getCell(row, 2).font = dataFont();
    ws.getCell(row, 2).alignment = { horizontal: 'center' };
    ws.getCell(row, 2).border = thinBorder();

    ws.getCell(row, 3).value = summary.totalAmt;
    ws.getCell(row, 3).numFmt = '#,##0';
    ws.getCell(row, 3).font = { ...dataFont(), bold: true };
    ws.getCell(row, 3).alignment = { horizontal: 'right' };
    ws.getCell(row, 3).border = thinBorder();
    row++;
  }
  row += 2;

  // 4. Cadangan Team Support
  const sectionTitle3 = ws.getCell(row, 1);
  sectionTitle3.value = 'Cadangan Team Support Handle';
  sectionTitle3.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, 1, row, 6);
  row += 1;

  ['Nama', 'Tahun Cakupan', 'Nominal'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = headerFont();
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  row++;

  const supportSplits = yearSplits.filter(s => s.role === 'support');
  const supportSummary = new Map<string, number>();
  for (const s of supportSplits) {
    const key = s.user_name || s.user_id;
    supportSummary.set(key, (supportSummary.get(key) || 0) + s.amount);
  }

  for (const [name, amount] of supportSummary) {
    ws.getCell(row, 1).value = name;
    ws.getCell(row, 1).font = dataFont();
    ws.getCell(row, 1).border = thinBorder();

    ws.getCell(row, 2).value = String(year);
    ws.getCell(row, 2).font = dataFont();
    ws.getCell(row, 2).alignment = { horizontal: 'center' };
    ws.getCell(row, 2).border = thinBorder();

    ws.getCell(row, 3).value = amount;
    ws.getCell(row, 3).numFmt = '#,##0';
    ws.getCell(row, 3).font = { ...dataFont(), bold: true };
    ws.getCell(row, 3).alignment = { horizontal: 'right' };
    ws.getCell(row, 3).border = thinBorder();
    row++;
  }
  if (supportSummary.size === 0) {
    ws.getCell(row, 1).value = '(Tidak ada support pada periode ini)';
    ws.getCell(row, 1).font = { ...dataFont(), italic: true, color: { argb: '999999' } };
    ws.mergeCells(row, 1, row, 3);
    row++;
  }
  row += 2;

  // 5. Footer: Tanda tangan
  const city = 'Jakarta';
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  ws.getCell(row, 1).value = `${city}, ${dateStr}`;
  ws.getCell(row, 1).font = dataFont();
  ws.mergeCells(row, 1, row, 3);
  row += 2;

  ws.getCell(row, 1).value = 'Dibuat oleh,';
  ws.getCell(row, 1).font = dataFont();
  ws.getCell(row, 4).value = 'Menyetujui,';
  ws.getCell(row, 4).font = dataFont();
  row += 4;

  ws.getCell(row, 1).value = managerName;
  ws.getCell(row, 1).font = { ...dataFont(), bold: true, underline: true };
  ws.getCell(row, 4).value = directorName;
  ws.getCell(row, 4).font = { ...dataFont(), bold: true, underline: true };
  row += 1;

  ws.getCell(row, 1).value = 'Manager PTS IVP';
  ws.getCell(row, 1).font = { ...dataFont(), italic: true };
  ws.getCell(row, 4).value = 'Director';
  ws.getCell(row, 4).font = { ...dataFont(), italic: true };

  // Column widths
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 35;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 18;
  for (let c = 5; c <= totalCols; c++) {
    ws.getColumn(c).width = c % 2 === 1 ? 8 : 16;
  }

  ws.views = [{ state: 'frozen', ySplit: groupHeaderRow + 1, xSplit: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Pengajuan_Incentive_PTS_IVP_${year}.xlsx`);
}

// Summary Export (semua project, split dihitung on-the-fly)

export async function exportSummaryIncentive(data: {
  projects: IncentiveProjectRow[];
  allUsers: { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[];
  supportsMap: Map<string, { user_id: string; user_name: string }[]>;
  managerName: string;
  managerUserId: string;
}) {
  const { projects, allUsers, supportsMap, managerName, managerUserId } = data;
  const orgList = allUsers as unknown as OrgUser[];
  // Skema pembagian dibaca sekali untuk seluruh berkas: satu rekap harus
  // memakai satu aturan, bukan campuran bila ada perubahan di tengah proses.
  const sk = await ambilSkema();
  // Akumulasi total per orang (hanya project dgn nominal & mode final)
  const personMap = new Map<string, { name: string; role: string; amount: number; count: number }>();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Summary Semua Incentive', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  let row = 1;

  // Title
  const titleCell = ws.getCell(row, 1);
  titleCell.value = `Summary Incentive PTS IVP — Semua Project`;
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, 1, row, 12);
  ws.getRow(row).height = 28;
  row++;

  const genCell = ws.getCell(row, 1);
  genCell.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Dibuat oleh: ${managerName}`;
  genCell.font = { italic: true, size: 9, name: 'Arial', color: { argb: '888888' } };
  ws.mergeCells(row, 1, row, 12);
  row += 2;

  // Column headers
  const COLS = [
    { h: 'No',            w: 5  },
    { h: 'Project',       w: 38 },
    { h: 'Handler',       w: 18 },
    { h: 'Kategori',      w: 18 },
    { h: 'Mode',          w: 10 },
    { h: 'BAST',          w: 13 },
    { h: 'Nominal (Rp)',  w: 18 },
    { h: 'PIC\nNama / %',        w: 24 },
    { h: 'Support\nNama / %',    w: 24 },
    { h: 'Supervisor\nNama / %', w: 24 },
    { h: 'Manager\nNama / %',    w: 24 },
    { h: 'Installer\nNama / %',  w: 24 },
  ];

  COLS.forEach((col, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = col.h;
    cell.font = headerFont(10);
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
    ws.getColumn(i + 1).width = col.w;
  });
  ws.getRow(row).height = 36;
  const headerRow = row;
  row++;

  const dataStart = row;

  for (let idx = 0; idx < projects.length; idx++) {
    const p = projects[idx];
    const isAlt = idx % 2 === 1;
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F9FA' } };

    const projectSupports = supportsMap.get(p.project_name) || [];
    // Supervisor & Manager dari Struktur Organisasi (atasan_id), resolve PIC via id/nama
    const picId = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgList);
    const supUp = findUpline(picId, 'Supervisor', orgList);
    const mgrUp = findUpline(picId, 'Manager', orgList);
    const supervisorId   = (supUp?.id        || '') as string;
    const supervisorName = (supUp?.full_name || 'Supervisor') as string;
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerName;

    const hasNominal = (p.incentive_value || 0) > 0;
    const effectivePool = hasNominal ? p.incentive_value : 1_000_000;
    const effectiveMode = p.mode_penyelesaian || 'onsite';
    const displayProject = { ...p, incentive_value: effectivePool, mode_penyelesaian: effectiveMode };
    const splits = calculateIncentiveSplits(sk, displayProject, projManagerId, projManagerName, supervisorId, supervisorName, projectSupports);
    const isEstimate = !hasNominal || !p.mode_penyelesaian;

    // Akumulasi total per orang - hanya project final (ada nominal & mode), pakai amount asli
    if (!isEstimate) {
      for (const s of splits) {
        const nm = s.user_name || '—';
        const key = `${s.role}::${nm}`;
        const prev = personMap.get(key) || { name: nm, role: s.role, amount: 0, count: 0 };
        prev.amount += s.amount;
        prev.count += 1;
        personMap.set(key, prev);
      }
    }

    const picSplit    = splits.find((s: SplitResult) => s.role === 'pic');
    const suppSplits  = splits.filter((s: SplitResult) => s.role === 'support');
    const supvSplit   = splits.find((s: SplitResult) => s.role === 'supervisor');
    const mgrSplit    = splits.find((s: SplitResult) => s.role === 'manager');
    const instSplit   = splits.find((s: SplitResult) => s.role === 'installer');

    const fmtSplit = (s: SplitResult | undefined, pool: number, est: boolean): string => {
      if (!s) return '—';
      const pct = formatPct(s.percentage);
      const amt = pool > 0 && !est ? '\n' + formatRupiah(s.amount) : '';
      return `${s.user_name}\n${pct}${amt}`;
    };
    const fmtMulti = (arr: SplitResult[], pool: number, est: boolean): string => {
      if (!arr.length) return '—';
      return arr.map(s => {
        const amt = pool > 0 && !est ? ' · ' + formatRupiah(s.amount) : '';
        return `${s.user_name} ${formatPct(s.percentage)}${amt}`;
      }).join('\n');
    };

    const rowData: (string | number)[] = [
      idx + 1,
      p.project_name,
      p.assign_name || '—',
      p.category,
      effectiveMode === 'remote' ? 'Remote' : 'Onsite',
      p.bast_date ? new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      hasNominal ? p.incentive_value : 0,
      fmtSplit(picSplit,   hasNominal ? p.incentive_value : 0, isEstimate),
      fmtMulti(suppSplits, hasNominal ? p.incentive_value : 0, isEstimate),
      fmtSplit(supvSplit,  hasNominal ? p.incentive_value : 0, isEstimate),
      fmtSplit(mgrSplit,   hasNominal ? p.incentive_value : 0, isEstimate),
      fmtSplit(instSplit,  hasNominal ? p.incentive_value : 0, isEstimate),
    ];

    rowData.forEach((val, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = val;
      cell.font = i === 6 ? { ...dataFont(), bold: true } : dataFont();
      cell.border = thinBorder();
      if (isAlt) cell.fill = altFill;
      if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (i === 6) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (!hasNominal) {
          cell.font = { ...dataFont(), italic: true, color: { argb: 'BBBBBB' } };
          cell.value = 'belum input';
        }
      } else if (i >= 7) {
        cell.alignment = { wrapText: true, vertical: 'top' };
        if (isEstimate) cell.font = { ...dataFont(), color: { argb: isEstimate && !hasNominal ? 'AAAAAA' : '888844' }, italic: isEstimate };
      } else {
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
    ws.getRow(row).height = 48;
    row++;
  }
  const dataEnd = row - 1;

  // Total row
  const totRow = row;
  ws.getCell(totRow, 1).value = 'TOTAL';
  ws.getCell(totRow, 1).font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell(totRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.getCell(totRow, 1).border = thinBorder();
  ws.mergeCells(totRow, 1, totRow, 6);
  ws.getCell(totRow, 7).value = { formula: `SUM(G${dataStart}:G${dataEnd})` };
  ws.getCell(totRow, 7).numFmt = '#,##0';
  ws.getCell(totRow, 7).font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell(totRow, 7).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(totRow, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.getCell(totRow, 7).border = thinBorder();
  for (let c = 8; c <= 12; c++) {
    ws.getCell(totRow, c).border = thinBorder();
    ws.getCell(totRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  }

  // Estimate note
  row = totRow + 2;
  ws.getCell(row, 1).value = '* Estimasi: ditampilkan jika nominal belum diinput atau mode penyelesaian belum diset (default Onsite). Angka rupiah tidak tertera.';
  ws.getCell(row, 1).font = { italic: true, size: 9, name: 'Arial', color: { argb: 'BBBB44' } };
  ws.mergeCells(row, 1, row, 12);

  // Rekapitulasi Total Incentive Per Orang
  row += 2;
  const rpTitle = ws.getCell(row, 1);
  rpTitle.value = 'Rekapitulasi Total Incentive Per Orang';
  rpTitle.font = { bold: true, size: 12, name: 'Arial', color: { argb: NAVY } };
  ws.mergeCells(row, 1, row, 4);
  row++;
  const rpSub = ws.getCell(row, 1);
  rpSub.value = 'Akumulasi seluruh project dgn nominal & mode final (estimasi tidak dihitung)';
  rpSub.font = { italic: true, size: 9, name: 'Arial', color: { argb: '888888' } };
  ws.mergeCells(row, 1, row, 4);
  row++;

  ['Nama', 'Role', 'Jumlah Project', 'Total Nominal (Rp)'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = headerFont(10);
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  row++;

  const roleOrder: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3, installer: 4 };
  const roleLabel = (r: string) => r === 'pic' ? 'PIC' : r === 'support' ? 'Support' : r === 'supervisor' ? 'Supervisor' : r === 'manager' ? 'Manager' : 'Installer';
  const persons = [...personMap.values()].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || a.name.localeCompare(b.name, 'id'));

  const pStart = row;
  persons.forEach((person, idx) => {
    const isAlt = idx % 2 === 1;
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F9FA' } };
    [person.name, roleLabel(person.role), person.count, person.amount].forEach((val, ci) => {
      const cell = ws.getCell(row, ci + 1);
      cell.value = val;
      cell.font = ci === 3 ? { ...dataFont(), bold: true } : dataFont();
      cell.border = thinBorder();
      if (isAlt) cell.fill = altFill;
      if (ci === 2) cell.alignment = { horizontal: 'center' };
      if (ci === 3) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
    });
    row++;
  });
  const pEnd = row - 1;
  if (persons.length === 0) {
    ws.getCell(row, 1).value = '(Belum ada project dengan nominal & mode final)';
    ws.getCell(row, 1).font = { ...dataFont(), italic: true, color: { argb: '999999' } };
    ws.mergeCells(row, 1, row, 4);
    row++;
  }

  // Grand Total per orang (= total pembagian semua orang)
  const gRow = row;
  ws.getCell(gRow, 1).value = 'GRAND TOTAL';
  ws.getCell(gRow, 1).font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell(gRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.getCell(gRow, 1).border = thinBorder();
  ws.mergeCells(gRow, 1, gRow, 3);
  const gCell = ws.getCell(gRow, 4);
  gCell.value = persons.length ? { formula: `SUM(D${pStart}:D${pEnd})` } : 0;
  gCell.numFmt = '#,##0';
  gCell.font = { bold: true, size: 10, name: 'Arial' };
  gCell.alignment = { horizontal: 'right' };
  gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  gCell.border = thinBorder();

  ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Summary_Incentive_PTS_IVP_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function getColLetter(colNum: number): string {
  let letter = '';
  let n = colNum;
  while (n > 0) {
    const mod = (n - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    n = Math.floor((n - mod) / 26);
  }
  return letter;
}
