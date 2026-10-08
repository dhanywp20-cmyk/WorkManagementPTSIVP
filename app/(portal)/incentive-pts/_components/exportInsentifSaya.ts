'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { IncentiveSplit, IncentiveTranche, IncentiveProjectRow } from './calc';

/**
 * Export personal - berbeda dari exportSummaryIncentive (exportPengajuan.ts):
 * itu rekap SELURUH tim, cuma untuk tingkat akses 'input'/'penuh'. Ini
 * cuma baris milik SATU orang, jadi aman diakses tier 'lihat' sekalipun -
 * datanya (`splits`) sudah harus difilter by user_id oleh pemanggil sebelum
 * sampai ke sini, fungsi ini tidak menyaring apa pun sendiri.
 */
export interface DataExportInsentifSaya {
  splits: IncentiveSplit[];
  trancheById: Map<string, IncentiveTranche>;
  projectById: Map<string, IncentiveProjectRow>;
  userName: string;
  /** Hanya untuk judul & nama berkas - penyaringan tahun dilakukan pemanggil. */
  year?: number | null;
}

const ROLE_LABEL: Record<string, string> = {
  pic: 'PIC', support: 'Support', supervisor: 'Supervisor', manager: 'Manager', installer: 'PTS Daerah',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Proses', processed: 'Diproses', paid: 'Sudah Cair',
};
const RUPIAH_FMT = '#,##0;(#,##0);"-"';

export async function exportInsentifSaya(data: DataExportInsentifSaya) {
  const { splits, trancheById, projectById, userName, year } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Insentif Saya');

  ws.mergeCells('A1:F1');
  const cTitle = ws.getCell('A1');
  cTitle.value = `Insentif Saya — ${userName}${year != null ? ` (Tahun BAST ${year})` : ' (Semua Tahun)'}`;
  cTitle.font = { bold: true, size: 13, name: 'Arial' };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 22;

  ws.mergeCells('A2:F2');
  const cGen = ws.getCell('A2');
  cGen.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  cGen.font = { italic: true, size: 9, name: 'Arial', color: { argb: '666666' } };

  //  Cuma `key`+`width` - TANPA `header` di sini. Assign ke ws.columns dengan
  //  properti `header` diisi otomatis MENULIS baris 1 oleh ExcelJS sendiri,
  //  yang akan menimpa judul gabungan A1:F1 di atas. Kepala tabel sungguhan
  //  ditulis manual di baris 4 (HEADERS di bawah), terpisah dari sini.
  ws.columns = [
    { key: 'no', width: 5 },
    { key: 'project', width: 34 },
    { key: 'peran', width: 14 },
    { key: 'tahun', width: 13 },
    { key: 'status', width: 16 },
    { key: 'jumlah', width: 16 },
  ];

  const HEADERS = ['No', 'Project', 'Peran', 'Tahun Bayar', 'Status', 'Jumlah (Rp)'];
  const hdrRow = ws.getRow(4);
  HEADERS.forEach((teks, i) => { hdrRow.getCell(i + 1).value = teks; });
  hdrRow.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFF' }, name: 'Arial', size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const baris = splits
    .map(s => ({
      split: s,
      tranche: s.tranche_id ? trancheById.get(s.tranche_id) : undefined,
      project: projectById.get(s.project_id),
    }))
    .sort((a, b) => (a.tranche?.payment_year ?? 0) - (b.tranche?.payment_year ?? 0)
      || (a.project?.project_name ?? '').localeCompare(b.project?.project_name ?? '', 'id'));

  baris.forEach((b, i) => {
    const r = ws.addRow({
      no: i + 1,
      project: b.project?.project_name ?? '—',
      peran: ROLE_LABEL[b.split.role] ?? b.split.role,
      tahun: b.tranche?.payment_year ?? '—',
      status: b.tranche ? (STATUS_LABEL[b.tranche.status] ?? b.tranche.status) : '—',
      jumlah: b.split.amount,
    });
    r.eachCell(c => { c.font = { name: 'Arial', size: 10 }; c.alignment = { vertical: 'middle' }; });
    r.getCell('jumlah').numFmt = RUPIAH_FMT;
    r.getCell('jumlah').alignment = { horizontal: 'right', vertical: 'middle' };
  });

  if (baris.length === 0) {
    ws.mergeCells(`A5:F5`);
    const cKosong = ws.getCell('A5');
    cKosong.value = 'Belum ada bagian insentif tercatat untuk periode ini.';
    cKosong.font = { italic: true, size: 10, color: { argb: '999999' }, name: 'Arial' };
  } else {
    const totalRow = ws.addRow({ project: 'TOTAL', jumlah: baris.reduce((n, b) => n + (b.split.amount || 0), 0) });
    totalRow.eachCell(c => {
      c.font = { bold: true, name: 'Arial', size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E1F2' } };
    });
    totalRow.getCell('jumlah').numFmt = RUPIAH_FMT;
    totalRow.getCell('jumlah').alignment = { horizontal: 'right', vertical: 'middle' };
  }

  const buf = await wb.xlsx.writeBuffer();
  const namaFile = `Insentif Saya - ${userName}${year != null ? ` - ${year}` : ''}.xlsx`;
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), namaFile);
}
