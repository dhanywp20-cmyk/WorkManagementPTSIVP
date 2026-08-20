'use client';

import React from 'react';

import * as XLSX from 'xlsx-js-style';

import { KPIMember, KPISettings, fmt, MONTHS_ID } from './shared';

/**
 * Ekspor rekap KPI ke Excel. Tidak menyentuh state halaman - seluruh datanya diterima sebagai argumen.
 */

export function exportKPIExcel(
  members: KPIMember[],
  period: string,
  settings: KPISettings,
  yearLabel?: string
) {
  const wb = XLSX.utils.book_new();
  const periodLabel = yearLabel ?? period;

  members.forEach(member => {
    // Calculate KPI scores
    const lcFailed = member.lcScores.filter(sc => sc < settings.lcMinScore).length;
    const tickS  = member.ticketsHandled > 0 ? Math.max(0, 1 - member.ticketsOverdue / Math.max(member.ticketsHandled, 1)) : 0;
    const bastS  = member.formReviewTotal === 0 ? 0 : member.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - member.formReviewLowRating / Math.max(member.formReviewTotal, 1));
    const lcS    = member.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailed / Math.max(member.lcAttempts, 1));
    const rndS   = member.techNotesApproved >= settings.rndTarget ? 1 : member.techNotesApproved / Math.max(settings.rndTarget, 1);

    // KPI template bobot (from official template)
    const BOBOT_TECH     = 0.15; // Technical Knowledge (Troubleshooting)
    const BOBOT_RESPON   = 0.10; // Kecepatan Respon
    const BOBOT_LC       = 0.35; // Learning Center Platform
    const BOBOT_BAST     = 0.20; // BAST Demo Product
    const BOBOT_RND      = 0.15; // R&D Tech Note
    const BOBOT_LAPORAN  = 0.05; // Pelaporan Report Bulanan

    const techPct   = Math.round(tickS * 100);
    const responPct = member.ticketsHandled > 0
      ? Math.max(0, Math.round((1 - Math.min(member.ticketAvgResponseHours, 48) / 48) * 100))
      : 0;
    const lcPct    = Math.round(lcS * 100);
    const bastPct  = Math.round(bastS * 100);
    const rndPct   = Math.round(rndS * 100);
    const laporanPct = member.piketFilled > 0 ? 100 : 0;

    const nilaiAkhir =
      BOBOT_TECH * (techPct / 100) +
      BOBOT_RESPON * (responPct / 100) +
      BOBOT_LC * (lcPct / 100) +
      BOBOT_BAST * (bastPct / 100) +
      BOBOT_RND * (rndPct / 100) +
      BOBOT_LAPORAN * (laporanPct / 100);

    // Build sheet data
    // Column layout: A=No, B=KPI Item, C=Target, D..O=Jan-Dec, P=Rata2, Q=Bobot, R=Nilai Akhir
    const COL_COUNT = 18; // A to R

    const E = (v: string | number | null) => v ?? '';

    const rows: (string | number | null)[][] = [
      // Row 1: Company
      ['INDOVISUAL GROUP', ...Array(COL_COUNT - 1).fill(null)],
      // Row 2: empty
      Array(COL_COUNT).fill(null),
      // Row 3: Title
      ['FORMULIR MONITORING KEY PERFORMANCE INDICATOR', ...Array(COL_COUNT - 1).fill(null)],
      // Row 4: empty
      Array(COL_COUNT).fill(null),
      // Row 5: Nama / No. Karyawan
      ['Nama', ':', member.name, null, null, null, null, null, null, 'No. Karyawan', ':', '-', ...Array(COL_COUNT - 12).fill(null)],
      // Row 6: Divisi / Level
      ['Divisi / Department', ':', member.team_type, null, null, null, null, null, null, 'Level / Posisi', ':', member.jabatan ?? '-', ...Array(COL_COUNT - 12).fill(null)],
      // Row 7: Periode
      ['Periode Penilaian', ':', periodLabel, ...Array(COL_COUNT - 3).fill(null)],
      // Row 8: empty
      Array(COL_COUNT).fill(null),
      // Row 9: Table header row 1
      ['No', 'Sasaran / KPI Item', 'Uraian', ...MONTHS_ID, 'Rata2 / Total', 'BOBOT', 'Nilai Akhir'],
      // Row 10: Customer Perspective header
      [null, 'CUSTOMER PERSPECTIVE', ...Array(COL_COUNT - 2).fill(null)],
      // Row 11: Technical Knowledge - header
      ['I', 'Technical Knowledge\n(Troubleshooting)', null, ...Array(14).fill(null)],
      // Row 12: Technical Knowledge - Target
      [null, null, 'Target', ...Array(12).fill('0 Overdue'), 100, BOBOT_TECH, null],
      // Row 13: Technical Knowledge - Aktual
      [null, null, 'Aktual', ...member.monthlyTickets.map((t, i) => {
        // monthly overdue not available, show total tickets
        return t;
      }), member.ticketsHandled, null, null],
      // Row 14: Technical Knowledge - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), techPct + '%', null, Math.round(BOBOT_TECH * (techPct / 100) * 100) / 100],
      // Row 15: Kecepatan Respon - header
      ['II', 'Kecepatan Respon\n(Response Ticket)', null, ...Array(14).fill(null)],
      // Row 16: Kecepatan Respon - Target
      [null, null, 'Target', ...Array(12).fill('< 2 Jam'), '< 2 Jam Rata2', BOBOT_RESPON, null],
      // Row 17: Kecepatan Respon - Aktual
      [null, null, 'Aktual', ...Array(12).fill(null), member.ticketAvgResponseHours > 0 ? member.ticketAvgResponseHours.toFixed(1) + ' Jam' : '—', null, null],
      // Row 18: Kecepatan Respon - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), responPct + '%', null, Math.round(BOBOT_RESPON * (responPct / 100) * 100) / 100],
      // Row 19: Internal Process header
      [null, 'INTERNAL PROCESS PERSPECTIVE', ...Array(COL_COUNT - 2).fill(null)],
      // Row 20: Learning Center - header
      ['III', 'Learning Center Platform', null, ...Array(14).fill(null)],
      // Row 21: LC - Target
      [null, null, 'Target', ...Array(12).fill('Lulus ≥' + settings.lcMinScore + '%'), '100%', BOBOT_LC, null],
      // Row 22: LC - Aktual
      [null, null, 'Aktual', ...Array(12).fill(null),
        member.lcAttempts > 0 ? `${member.lcPassed}/${member.lcAttempts} lulus` : '—', null, null],
      // Row 23: LC - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), lcPct + '%', null, Math.round(BOBOT_LC * (lcPct / 100) * 100) / 100],
      // Row 24: BAST Demo - header
      ['IV', 'BAST Demo Product', null, ...Array(14).fill(null)],
      // Row 25: BAST - Target
      [null, null, 'Target', ...Array(12).fill('0 Komplain'), '0 Komplain', BOBOT_BAST, null],
      // Row 26: BAST - Aktual
      [null, null, 'Aktual', ...Array(12).fill(null),
        member.formReviewTotal > 0 ? `${member.formReviewLowRating} komplain / ${member.formReviewTotal} review` : '—', null, null],
      // Row 27: BAST - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), bastPct + '%', null, Math.round(BOBOT_BAST * (bastPct / 100) * 100) / 100],
      // Row 28: R&D Tech Note - header
      ['V', 'R&D Tech Note', null, ...Array(14).fill(null)],
      // Row 29: RnD - Target
      [null, null, 'Target', ...Array(12).fill(null), settings.rndTarget + ' Tech Note', BOBOT_RND, null],
      // Row 30: RnD - Aktual
      [null, null, 'Aktual', ...Array(12).fill(null), member.techNotesApproved + ' approved', null, null],
      // Row 31: RnD - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), rndPct + '%', null, Math.round(BOBOT_RND * (rndPct / 100) * 100) / 100],
      // Row 32: Pelaporan Bulanan - header
      ['VI', 'Pelaporan Report Bulanan', null, ...Array(14).fill(null)],
      // Row 33: Laporan - Target
      [null, null, 'Target', ...Array(12).fill('1 Laporan'), '12 Laporan', BOBOT_LAPORAN, null],
      // Row 34: Laporan - Aktual
      [null, null, 'Aktual', ...Array(12).fill(null), member.piketFilled > 0 ? member.piketFilled + ' laporan' : '—', null, null],
      // Row 35: Laporan - % Pencapaian
      [null, null, '% Pencapaian', ...Array(12).fill(null), laporanPct + '%', null, Math.round(BOBOT_LAPORAN * (laporanPct / 100) * 100) / 100],
      // Row 36: empty
      Array(COL_COUNT).fill(null),
      // Row 37: Total
      [null, 'TOTAL NILAI', null, ...Array(13).fill(null), '1.00', (nilaiAkhir * 100).toFixed(1) + '%'],
      // Row 38: empty
      Array(COL_COUNT).fill(null),
      // Row 39: Catatan
      ['Catatan Insiden Penting:', ...Array(COL_COUNT - 1).fill(null)],
      // Row 40: empty
      Array(COL_COUNT).fill(null),
      // Row 41: empty
      Array(COL_COUNT).fill(null),
      // Row 42: Signature header
      ['Dibuat oleh,', null, null, null, null, 'Diperiksa oleh,', null, null, null, null, 'Disetujui oleh,', ...Array(COL_COUNT - 11).fill(null)],
      // Row 43-45: empty (space for signature)
      Array(COL_COUNT).fill(null),
      Array(COL_COUNT).fill(null),
      Array(COL_COUNT).fill(null),
      // Row 46: Names
      [member.name, null, null, null, null, 'Dhany Wahyu Perdana', null, null, null, null, 'Jonny', ...Array(COL_COUNT - 11).fill(null)],
      // Row 47: Title
      ['Karyawan', null, null, null, null, 'Manager / Atasan Langsung', null, null, null, null, 'Direktur / Atasan Berikutnya', ...Array(COL_COUNT - 11).fill(null)],
    ];
    E; // suppress unused warning

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Cell styling
    const thin = { style: 'thin' as const, color: { rgb: 'FFD1D5DB' } };
    const med  = { style: 'medium' as const, color: { rgb: 'FF6B7280' } };
    const bThin = { top: thin, bottom: thin, left: thin, right: thin };
    const bMed  = { top: med,  bottom: med,  left: med,  right: med  };
    const F = (bold = false, sz = 10, rgb = 'FF1F2937') =>
      ({ name: 'Calibri', sz, bold, color: { rgb } });
    const BG = (rgb: string) => ({ patternType: 'solid' as const, fgColor: { rgb } });

    const sc = (R: number, C: number, s: object) => {
      const a = XLSX.utils.encode_cell({ r: R, c: C });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(ws as any)[a]) (ws as any)[a] = { t: 's', v: '' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any)[a].s = s;
    };
    const fr = (R: number, s: object) => { for (let C = 0; C < COL_COUNT; C++) sc(R, C, s); };
    const rng = (r1: number, r2: number, s: object) => { for (let R = r1; R <= r2; R++) fr(R, s); };

    // Base: thin border on entire table (header  total NILAI)
    rng(8, 36, { font: F(), border: bThin, alignment: { vertical: 'center' } });

    // Table column header row (idx 8): navy bg, white bold
    fr(8, {
      font: F(true, 10, 'FFFFFFFF'), fill: BG('FF1E3A5F'), border: bMed,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });

    // CUSTOMER PERSPECTIVE (idx 9): blue tint
    fr(9, {
      font: F(true, 10, 'FF1D4ED8'), fill: BG('FFDBEAFE'), border: bThin,
      alignment: { vertical: 'center' },
    });

    // INTERNAL PROCESS PERSPECTIVE (idx 18): green tint
    fr(18, {
      font: F(true, 10, 'FF065F46'), fill: BG('FFD1FAE5'), border: bThin,
      alignment: { vertical: 'center' },
    });

    // KPI section number rows (I,II,III,IV,V,VI): soft gray, bold
    [10, 14, 19, 23, 27, 31].forEach(R => fr(R, {
      font: F(true, 10, 'FF374151'), fill: BG('FFF1F5F9'), border: bThin,
      alignment: { vertical: 'center', wrapText: true },
    }));

    // Target rows: sky tint, blue text, centered
    [11, 15, 20, 24, 28, 32].forEach(R => fr(R, {
      font: F(false, 9, 'FF1D4ED8'), fill: BG('FFF0F9FF'), border: bThin,
      alignment: { horizontal: 'center', vertical: 'center' },
    }));

    // Aktual rows: white bg
    [12, 16, 21, 25, 29, 33].forEach(R => fr(R, {
      font: F(false, 10, 'FF111827'), fill: BG('FFFFFFFF'), border: bThin,
      alignment: { vertical: 'center' },
    }));

    // % Pencapaian rows: green tint, bold, right-align value columns
    [13, 17, 22, 26, 30, 34].forEach(R => fr(R, {
      font: F(true, 10, 'FF059669'), fill: BG('FFF0FDF4'), border: bThin,
      alignment: { horizontal: 'right', vertical: 'center' },
    }));

    // TOTAL NILAI row (idx 36): amber bg, bold, medium border
    fr(36, {
      font: F(true, 11, 'FF78350F'), fill: BG('FFFEF3C7'), border: bMed,
      alignment: { vertical: 'center' },
    });

    // Company name (idx 0): large bold
    sc(0, 0, { font: F(true, 14), alignment: { horizontal: 'left', vertical: 'center' } });

    // Form title (idx 2): medium bold
    sc(2, 0, { font: F(true, 12), alignment: { horizontal: 'left', vertical: 'center' } });

    // Info label cells (idx 4–6): bold labels
    [[4,0],[4,9],[5,0],[5,9],[6,0]].forEach(([R,C]) =>
      sc(R, C, { font: F(true, 10), alignment: { horizontal: 'left', vertical: 'center' } }));

    // Fix: left-align Uraian column (C=2) in all table rows
    for (let R = 8; R <= 34; R++) sc(R, 2, {
      font: F(false, 10), border: bThin,
      alignment: { horizontal: 'left', vertical: 'center' },
    });

    // Row heights
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any)['!rows'] = rows.map((_, i) => {
      if (i === 0)  return { hpx: 28 };
      if (i === 2)  return { hpx: 22 };
      if (i === 8)  return { hpx: 30 };
      if (i === 9 || i === 18) return { hpx: 20 };
      if ([10,14,19,23,27,31].includes(i)) return { hpx: 22 };
      if (i === 36) return { hpx: 24 };
      return { hpx: 18 };
    });

    // Column widths
    ws['!cols'] = [
      { wch: 5 },  // A: No
      { wch: 30 }, // B: KPI Item
      { wch: 18 }, // C: Uraian
      ...Array(12).fill({ wch: 9 }), // D-O: Jan-Dec
      { wch: 18 }, // P: Rata2
      { wch: 8 },  // Q: Bobot
      { wch: 12 }, // R: Nilai Akhir
    ];

    // Merges for headers
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } },  // Row 1: Company
      { s: { r: 2, c: 0 }, e: { r: 2, c: COL_COUNT - 1 } },  // Row 3: Title
      { s: { r: 9, c: 1 }, e: { r: 9, c: COL_COUNT - 1 } },  // Customer Perspective
      { s: { r: 10, c: 1 }, e: { r: 12, c: 1 } },             // Tech Knowledge KPI item (3 rows merged)
      { s: { r: 14, c: 1 }, e: { r: 16, c: 1 } },             // Kecepatan Respon
      { s: { r: 18, c: 1 }, e: { r: 18, c: COL_COUNT - 1 } }, // Internal Process
      { s: { r: 19, c: 1 }, e: { r: 21, c: 1 } },             // LC
      { s: { r: 23, c: 1 }, e: { r: 25, c: 1 } },             // BAST
      { s: { r: 27, c: 1 }, e: { r: 29, c: 1 } },             // RnD
      { s: { r: 31, c: 1 }, e: { r: 33, c: 1 } },             // Laporan
    ];

    // Sheet name: limit to 31 chars (Excel max), strip invalid chars
    const sheetName = member.name.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Write and download
  const today = fmt(new Date());
  const filename = `KPI-IVP-${periodLabel.replace(/\s/g, '-')}-${today}.xlsx`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', cellStyles: true } as any);
}
