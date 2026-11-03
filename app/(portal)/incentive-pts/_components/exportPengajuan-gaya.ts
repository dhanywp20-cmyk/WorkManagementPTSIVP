'use client';
import ExcelJS from 'exceljs';

const NAVY = '1B3A6B';

const LIGHT_GRAY = 'F5F5F5';

const BORDER_COLOR = 'CCCCCC';

export function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } };
  return { top: side, bottom: side, left: side, right: side };
}

function headerFont(size = 10): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: 'FFFFFF' }, size, name: 'Arial' };
}

function headerFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
}

export function dataFont(size = 10): Partial<ExcelJS.Font> {
  return { name: 'Arial', size };
}

export function sumCell(formula: string, result: number): { formula: string; result: number } {
  return { formula, result };
}

const ROLE_JUDUL: Record<string, string> = {
  pic: 'PIC', support: 'Support', supervisor: 'Supervisor',
  manager: 'Manager', installer: 'PTS Daerah',
};

export const NAVY_HDR = '1F3864';

export const SUB_HDR = '2E5395';

export const TOTAL_FILL = 'D9E1F2';

export const INSTALLER_FILL = 'FFF2CC';

export const RUPIAH_FMT = '#,##0;(#,##0);"-"';

export const putih = (): Partial<ExcelJS.Font> => ({ bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Arial' });

export const fillWarna = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });

export const KOL = { no: 2, project: 3, mode: 4, bast: 5, nominal: 6 };

export const KOL_ORANG_AWAL = 7;

export function aturLebarKolom(
  ws: ExcelJS.Worksheet,
  kolOrang: { posisi: number; pct: number; rp: number }[],
  kolInst: { nama: number; lokasi: number; pct: number; rp: number },
) {
  ws.getColumn(1).width = 3;
  ws.getColumn(KOL.no).width = 5;
  ws.getColumn(KOL.project).width = 30;
  ws.getColumn(KOL.mode).width = 10;
  ws.getColumn(KOL.bast).width = 13;
  ws.getColumn(KOL.nominal).width = 15;
  for (const ko of kolOrang) {
    ws.getColumn(ko.posisi).width = 12;
    ws.getColumn(ko.pct).width = 7;
    ws.getColumn(ko.rp).width = 14;
  }
  ws.getColumn(kolInst.nama).width = 17;
  ws.getColumn(kolInst.lokasi).width = 12;
  ws.getColumn(kolInst.pct).width = 7;
  ws.getColumn(kolInst.rp).width = 14;
}

export function tulisKepalaPerOrang(ws: ExcelJS.Worksheet, baris: number, judulKolom: [string, number, number][]) {
  for (const [teks, awal, akhir] of judulKolom) {
    const c = ws.getCell(baris, awal);
    c.value = teks; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    for (let k = awal; k <= akhir; k++) {
      const x = ws.getCell(baris, k);
      x.fill = fillWarna(NAVY_HDR); x.border = thinBorder();
    }
    if (akhir > awal) ws.mergeCells(baris, awal, baris, akhir);
  }
}

export function perbesarKolom(ws: ExcelJS.Worksheet, kolom: number, minimal: number) {
  const c = ws.getColumn(kolom);
  c.width = Math.max(c.width ?? 0, minimal);
}

export function hitungBarisTerbungkus(teks: string, lebarKarakter: number): number {
  return teks.split('\n').reduce((n, baris) => n + Math.max(1, Math.ceil(baris.length / lebarKarakter)), 0);
}

export const KOL_REKAP = {
  nama:   [KOL.no, KOL.project] as [number, number],
  peran:  [KOL.mode, KOL.bast] as [number, number],
  jumlah: [KOL.nominal, KOL.nominal] as [number, number],
  total: [KOL_ORANG_AWAL, KOL_ORANG_AWAL + 2] as [number, number],
};

export function selGabung(
  ws: ExcelJS.Worksheet, baris: number, rentang: [number, number],
  nilai: ExcelJS.CellValue, gaya?: { font?: Partial<ExcelJS.Font>; isi?: string; rata?: 'left' | 'right' | 'center' },
) {
  const [awal, akhir] = rentang;
  for (let k = awal; k <= akhir; k++) {
    const x = ws.getCell(baris, k);
    x.border = thinBorder();
    if (gaya?.isi) x.fill = fillWarna(gaya.isi);
  }
  if (akhir > awal) ws.mergeCells(baris, awal, baris, akhir);
  const c = ws.getCell(baris, awal);
  c.value = nilai;
  c.font = gaya?.font ?? dataFont();
  c.alignment = { vertical: 'middle', horizontal: gaya?.rata ?? 'left', wrapText: true };
  return c;
}
