'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { IncentiveProject, IncentiveSplit, IncentiveTranche, formatRupiah } from './shared';

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
  projects: IncentiveProject[];
  splits: IncentiveSplit[];
  tranches: (IncentiveTranche & { project?: IncentiveProject })[];
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

  // ─── 1. Title ──────────────────────────────────────────────────────────────
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

  // ─── 2. Daftar Project ────────────────────────────────────────────────────
  // Determine unique recipients across all projects
  const recipientMap = new Map<string, { user_id: string; user_name: string; role: string }>();
  for (const s of splits) {
    const key = `${s.user_id || s.user_name}_${s.role}`;
    if (!recipientMap.has(key)) {
      recipientMap.set(key, { user_id: s.user_id, user_name: s.user_name, role: s.role });
    }
  }
  const recipients = Array.from(recipientMap.values());

  // Build headers: No | Nama Project | User/Customer | Final Incentive | [Per recipient: % | Nominal]
  const baseHeaders = ['No', 'Nama Project', 'User / Customer', 'Final Incentive (Rp)'];
  const recipientHeaders: string[] = [];
  for (const r of recipients) {
    const roleLabel = r.role === 'pic' ? 'PIC' : r.role === 'support' ? 'Support' : r.role === 'manager' ? 'Manager' : 'Installer';
    recipientHeaders.push(`${r.user_name} (${roleLabel}) %`);
    recipientHeaders.push(`${r.user_name} (${roleLabel}) Nominal`);
  }
  const allHeaders = [...baseHeaders, ...recipientHeaders];
  const totalCols = allHeaders.length || 10;

  // Header row for project table — role group merge headers
  const groupHeaderRow = row;
  const groupHeaderWs = ws.getRow(groupHeaderRow);
  groupHeaderWs.height = 25;

  // Base column headers span 1 row
  for (let i = 0; i < baseHeaders.length; i++) {
    const cell = ws.getCell(groupHeaderRow, i + 1);
    cell.value = baseHeaders[i];
    cell.font = headerFont();
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
    ws.mergeCells(groupHeaderRow, i + 1, groupHeaderRow + 1, i + 1);
  }

  // Recipient group headers (merged across % and Nominal)
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

    // Sub-headers: % and Nominal
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

  // Data rows
  const dataStartRow = row;
  projects.forEach((p, idx) => {
    const r = ws.getRow(row);
    const isAlt = idx % 2 === 1;
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };

    // No
    const noCell = ws.getCell(row, 1);
    noCell.value = idx + 1;
    noCell.font = dataFont();
    noCell.alignment = { horizontal: 'center', vertical: 'middle' };
    noCell.border = thinBorder();
    if (isAlt) noCell.fill = altFill;

    // Nama Project
    const nameCell = ws.getCell(row, 2);
    nameCell.value = p.project_name;
    nameCell.font = dataFont();
    nameCell.alignment = { vertical: 'middle', wrapText: true };
    nameCell.border = thinBorder();
    if (isAlt) nameCell.fill = altFill;

    // User / Customer
    const custCell = ws.getCell(row, 3);
    custCell.value = p.sales_name || '';
    custCell.font = dataFont();
    custCell.alignment = { vertical: 'middle' };
    custCell.border = thinBorder();
    if (isAlt) custCell.fill = altFill;

    // Final Incentive
    const valCell = ws.getCell(row, 4);
    valCell.value = p.incentive_value || 0;
    valCell.numFmt = '#,##0';
    valCell.font = { ...dataFont(), bold: true };
    valCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valCell.border = thinBorder();
    if (isAlt) valCell.fill = altFill;

    // Per-recipient columns
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

  // Total row with SUM formulas
  const totalRow = row;
  const totLabelCell = ws.getCell(totalRow, 1);
  totLabelCell.value = 'TOTAL';
  totLabelCell.font = { ...headerFont(11), color: { argb: '000000' } };
  totLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totLabelCell.border = thinBorder();
  totLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.mergeCells(totalRow, 1, totalRow, 3);

  // SUM for Final Incentive
  const totValCell = ws.getCell(totalRow, 4);
  const colLetter4 = 'D';
  totValCell.value = { formula: `SUM(${colLetter4}${dataStartRow}:${colLetter4}${dataEndRow})` };
  totValCell.numFmt = '#,##0';
  totValCell.font = { ...dataFont(11), bold: true };
  totValCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totValCell.border = thinBorder();
  totValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  // SUM for each recipient nominal column
  let sumCol = 5;
  for (const _rec of recipients) {
    // % column — leave empty in total row
    const pctTot = ws.getCell(totalRow, sumCol);
    pctTot.border = thinBorder();
    pctTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    // Nominal column — SUM formula
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
  // ─── 3b. Per-Person Total (langsung di bawah TOTAL row) ──────────────────
  const personMap = new Map<string, { name: string; role: string; amount: number; count: number }>();
  for (const s of splits) {
    const key = `${s.role}::${s.user_name || s.user_id}`;
    const prev = personMap.get(key) || { name: s.user_name || '—', role: s.role, amount: 0, count: 0 };
    prev.amount += s.amount;
    prev.count += 1;
    personMap.set(key, prev);
  }

  const roleOrder: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3, installer: 4 };
  const sortedPersons = [...personMap.values()].sort((a, b) => {
    const ro = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
    if (ro !== 0) return ro;
    return a.name.localeCompare(b.name, 'id');
  });

  const roleLabel = (r: string) =>
    r === 'pic' ? 'PIC' : r === 'support' ? 'Support' : r === 'supervisor' ? 'Supervisor' : r === 'manager' ? 'Manager' : 'Installer';

  row += 1;

  const personTitleCell = ws.getCell(row, 1);
  personTitleCell.value = 'Rekapitulasi Total Incentive Per Orang';
  personTitleCell.font = { bold: true, size: 12, name: 'Arial', color: { argb: NAVY } };
  ws.mergeCells(row, 1, row, 5);
  row++;

  ['Nama', 'Role', 'Jumlah Project', 'Total Nominal (Rp)', 'Keterangan'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = headerFont();
    cell.fill = headerFill();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  row++;

  const personDataStart = row;
  sortedPersons.forEach((person, idx) => {
    const isAlt = idx % 2 === 1;
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFF' } };

    [person.name, roleLabel(person.role), person.count, person.amount, ''].forEach((val, ci) => {
      const cell = ws.getCell(row, ci + 1);
      cell.value = val;
      cell.font = dataFont();
      cell.border = thinBorder();
      if (ci === 2) cell.alignment = { horizontal: 'center' };
      if (ci === 3) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; cell.font = { ...dataFont(), bold: true }; }
      if (isAlt) cell.fill = altFill;
    });
    row++;
  });

  // Grand Total per-person
  const personDataEnd = row - 1;
  const gtLabel = ws.getCell(row, 1);
  gtLabel.value = 'GRAND TOTAL';
  gtLabel.font = { ...headerFont(11), color: { argb: '000000' } };
  gtLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  gtLabel.border = thinBorder();
  ws.mergeCells(row, 1, row, 3);

  const gtAmt = ws.getCell(row, 4);
  gtAmt.value = { formula: `SUM(D${personDataStart}:D${personDataEnd})` };
  gtAmt.numFmt = '#,##0';
  gtAmt.font = { ...dataFont(11), bold: true };
  gtAmt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  gtAmt.alignment = { horizontal: 'right' };
  gtAmt.border = thinBorder();

  const gtNote = ws.getCell(row, 5);
  gtNote.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  gtNote.border = thinBorder();

  row += 2;

  // ─── 4. Ringkasan per penerima per tahun ─────────────────────────────────
  const sectionTitle2 = ws.getCell(row, 1);
  sectionTitle2.value = 'Ringkasan Pencairan Per Penerima';
  sectionTitle2.font = { bold: true, size: 12, name: 'Arial' };
  sectionTitle2.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(row, 1, row, 6);
  row += 1;

  // Headers: Nama | then tranche year pairs (% | Nominal)
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

  // Group splits by user for this year's tranches
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

  for (const [_key, summary] of userSummary) {
    const nameCell = ws.getCell(row, 1);
    nameCell.value = summary.name;
    nameCell.font = dataFont();
    nameCell.border = thinBorder();

    const pctCell = ws.getCell(row, 2);
    pctCell.value = summary.totalPct / 100;
    pctCell.numFmt = '0.0%';
    pctCell.font = dataFont();
    pctCell.alignment = { horizontal: 'center' };
    pctCell.border = thinBorder();

    const amtCell = ws.getCell(row, 3);
    amtCell.value = summary.totalAmt;
    amtCell.numFmt = '#,##0';
    amtCell.font = { ...dataFont(), bold: true };
    amtCell.alignment = { horizontal: 'right' };
    amtCell.border = thinBorder();

    row++;
  }
  row += 2;

  // ─── 5. Cadangan Team Support ─────────────────────────────────────────────
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

  // ─── 6. Footer: Tanda tangan ──────────────────────────────────────────────
  const city = 'Jakarta';
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  ws.getCell(row, 1).value = `${city}, ${dateStr}`;
  ws.getCell(row, 1).font = dataFont();
  ws.mergeCells(row, 1, row, 3);
  row += 2;

  // Two signature columns
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

  // ─── Column widths ─────────────────────────────────────────────────────────
  ws.getColumn(1).width = 5;   // No
  ws.getColumn(2).width = 35;  // Nama Project
  ws.getColumn(3).width = 20;  // Customer
  ws.getColumn(4).width = 18;  // Final Incentive

  for (let c = 5; c <= totalCols; c++) {
    ws.getColumn(c).width = c % 2 === 1 ? 8 : 16; // % columns narrow, Nominal wider
  }

  // Freeze top rows (header)
  ws.views = [{ state: 'frozen', ySplit: groupHeaderRow + 1, xSplit: 0 }];

  // ─── Generate & Download ───────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Pengajuan_Incentive_PTS_IVP_${year}.xlsx`);
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
