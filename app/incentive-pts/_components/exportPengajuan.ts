'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  IncentiveProjectRow, IncentiveSplit, IncentiveTranche,
  SplitResult, formatRupiah, formatPct,
  calculateIncentiveSplits, findUpline, resolveUserId, OrgUser, ambilSkema, labelSkema,
  type SkemaInsentif,
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

/**
 * Sel `SUM()` yang MEMBAWA hasilnya sendiri, bukan formula kosong.
 *
 * Baris Total sebelumnya cuma menulis `{ formula: 'SUM(...)' }`, tanpa nilai
 * cache. Itu sah menurut format .xlsx - Excel dan Google Sheets menghitung
 * ulang begitu berkas dibuka - tapi banyak pembaca .xlsx ringan (pratinjau di
 * aplikasi file manager, viewer di dalam aplikasi chat, sebagian aplikasi
 * mobile) hanya menampilkan CACHE-nya apa adanya tanpa menjalankan mesin
 * formula. Tanpa cache, itu berarti sel yang tampak kosong - persis keluhan
 * "TOTAL dan GRAND TOTAL masih kosong".
 *
 * `result` di sini dihitung di JavaScript dari angka yang SAMA yang menulisi
 * baris-baris di atasnya, jadi formula-nya tetap ada untuk diperiksa manual
 * di Excel/Sheets, sementara viewer yang tidak menghitung ulang pun langsung
 * menampilkan angka yang benar.
 */
function sumCell(formula: string, result: number): { formula: string; result: number } {
  return { formula, result };
}

interface ExportData {
  year: number;
  projects: IncentiveProjectRow[];
  splits: IncentiveSplit[];
  tranches: (IncentiveTranche & { project?: IncentiveProjectRow })[];
  managerName: string;
  directorName: string;
  /**
   * Pembagian hasil hitung untuk proyek yang tahapannya BELUM diproses.
   *
   * Dipakai hanya bila tidak ada baris tersimpan untuk proyek itu, supaya
   * rekap tetap bisa dibaca dan diperiksa sebelum Process Batch dijalankan.
   * Barisnya ditandai "(proyeksi)" di kolom Status - lihat catatannya di
   * exportPengajuanIncentive.
   */
  splitsProyeksi?: Map<string, SplitResult[]>;
}

/** Nama peran seperti yang dibaca Finance, bukan kunci teknisnya. */
const ROLE_JUDUL: Record<string, string> = {
  pic: 'PIC', support: 'Support', supervisor: 'Supervisor',
  manager: 'Manager', installer: 'Installer',
};

/*
  REKAP PENGAJUAN INSENTIF - bentuknya mengikuti dokumen yang selama ini
  dipakai ke Finance, bukan bentuk yang paling mudah dihasilkan program.

  Dua tabel, dan keduanya menjawab pertanyaan yang berbeda:

    Tabel 1  "siapa berhak berapa dari proyek mana"  - porsi PENUH tiap orang
             atas tiap proyek, tanpa memandang tahun. Kolom Kontrol di ujung
             kanan menjumlahkan persennya; kalau bukan 100% berarti ada porsi
             yang tidak menemukan penerimanya, dan itu harus ketahuan di
             lembar ini juga - bukan setahun kemudian saat ditanya Finance.

    Tabel 2  "kapan uang itu keluar" - porsi penuh tadi dipecah menurut
             Tahapan Pencairan (50/35/15) ke tahun pembayarannya masing-masing.
             Installer TIDAK ikut dipecah: porsinya lunas sekali di tahun
             pertama, dan di kolom tahun berikutnya ia bernilai nol.

  ANGKANYA TIDAK DIHITUNG ULANG DI SINI. `percentage` pada incentive_splits
  adalah porsi terhadap POOL PROYEK (mis. PIC 60), bukan terhadap satu tahap -
  jadi porsi penuh seseorang = pool x percentage, dan nilai per tahun = porsi
  penuh itu x persentase tahap. Dengan begitu rekap tahun ke-2 memakai angka
  yang sama persis dengan rekap tahun ke-1, karena keduanya berasal dari
  baris pembagian yang sama, bukan dari dua perhitungan yang kebetulan mirip.
*/
export async function exportPengajuanIncentive(data: ExportData) {
  const { year, projects, splits, tranches, managerName, directorName, splitsProyeksi } = data;

  const sk = await ambilSkema();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Pengajuan Incentive', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  /*
    Porsi PENUH tiap orang atas tiap proyek.

    Disaring per (proyek, orang, peran) karena satu proyek dicairkan beberapa
    kali: bila tahap 1 dan tahap 2 sama-sama sudah diproses, orang yang sama
    muncul dua kali dengan percentage yang identik. Menjumlahkannya akan
    melipatgandakan porsinya.
  */
  type Penerima = { nama: string; peran: string };
  const porsiPenuh = new Map<string, Map<string, { peran: string; persen: number; rupiah: number }>>();
  const orangSet = new Map<string, Penerima>();
  /** Proyek yang angkanya masih PROYEKSI, bukan hasil Process Batch. */
  const proyeksi = new Set<string>();

  for (const p of projects) {
    const perOrang = new Map<string, { peran: string; persen: number; rupiah: number }>();

    /*
      Baris pembagian yang TERSIMPAN selalu menang.

      Yang tersimpan adalah hasil Process Batch - dihitung dengan skema yang
      dibekukan saat itu, dan itulah yang sudah/akan dibayarkan. Menghitung
      ulang di sini berisiko menghasilkan angka lain bila skemanya sempat
      berubah, dan rekap yang berbeda dari yang dibayar lebih buruk daripada
      rekap yang tidak ada.

      Bila belum ada (tahapannya masih Pending), dipakai proyeksi yang
      dihitung dari skema yang berlaku sekarang. Rekapnya tetap bisa dibaca
      dan diperiksa sebelum batch dijalankan - hanya saja tiap barisnya
      ditandai di kolom Status, supaya tidak ada yang mengira angka proyeksi
      adalah angka yang sudah final.
    */
    const tersimpan = splits.filter(s => s.project_id === p.id);
    const dipakai: { role: string; user_name: string; user_id: string; percentage: number }[] =
      tersimpan.length > 0
        ? tersimpan
        : (splitsProyeksi?.get(p.id) ?? []).map(s => ({
            role: s.role, user_name: s.user_name, user_id: s.user_id, percentage: s.percentage,
          }));
    if (tersimpan.length === 0 && dipakai.length > 0) proyeksi.add(p.id);

    for (const s of dipakai) {
      const nama = s.user_name || s.user_id;
      if (!nama) continue;
      if (perOrang.has(nama)) continue;          // sudah tercatat dari tahap lain
      const persen = s.percentage || 0;
      perOrang.set(nama, {
        peran: s.role,
        persen,
        rupiah: Math.round(((p.incentive_value || 0) * persen) / 100),
      });
      if (!orangSet.has(nama)) orangSet.set(nama, { nama, peran: s.role });
    }
    porsiPenuh.set(p.id, perOrang);
  }

  const orang = Array.from(orangSet.values());

  /** Status pencairan satu proyek, dibaca dari tahapannya. */
  function statusProyek(projectId: string): string {
    const t = tranches.filter(x => x.project_id === projectId);
    if (t.length === 0) return 'Belum ada tahapan';
    if (t.every(x => x.status === 'paid')) return 'Paid';
    if (t.some(x => x.status === 'paid')) return 'Sebagian Paid';
    if (t.some(x => x.status === 'processed')) return 'Processed';
    return 'Pending';
  }

  let row = 1;
  const KOL_DASAR = 4;                  // No | Nama Project | Final Incentive | Status
  const kolKontrol = KOL_DASAR + orang.length * 2 + 1;
  const kolTerakhir = Math.max(kolKontrol, 8);

  // Judul
  const titleCell = ws.getCell(row, 1);
  titleCell.value = `Pengajuan Incentive Project-Project IVP Tahun ${year}`;
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, 1, row, kolTerakhir);
  row += 1;

  const introCell = ws.getCell(row, 1);
  introCell.value = 'Saya yang bertanda tangan di bawah ini, ingin mengajukan pengeluaran Incentive '
    + `Project-project IVP Tahun ${year} dengan dasar perhitungan sebagai berikut :`;
  introCell.font = dataFont(10);
  introCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.mergeCells(row, 1, row, kolTerakhir);
  row += 1;

  /*
    Penanda skema dicetak di rekap.

    Tanpa ini rekap hanya berisi nominal, dan setahun kemudian tidak ada yang
    bisa memastikan angka itu dihitung dengan aturan yang mana - terutama
    sesudah porsinya diubah. Satu baris ini membuat tiap lembar rekap membawa
    buktinya sendiri.
  */
  const skemaCell = ws.getCell(row, 1);
  skemaCell.value = `Dihitung dengan: ${labelSkema(sk)}`;
  skemaCell.font = { italic: true, size: 9, name: 'Arial', color: { argb: '666666' } };
  skemaCell.alignment = { horizontal: 'center' };
  ws.mergeCells(row, 1, row, kolTerakhir);
  row += 2;

  // TABEL 1 - porsi penuh per proyek
  const barisKepala = row;
  ws.getRow(barisKepala).height = 20;
  ws.getRow(barisKepala + 1).height = 18;

  const kepalaDasar = ['No', 'Nama Project', 'Final Incentive', 'Status'];
  kepalaDasar.forEach((h, i) => {
    const c = ws.getCell(barisKepala, i + 1);
    c.value = h;
    c.font = headerFont();
    c.fill = headerFill();
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder();
    ws.mergeCells(barisKepala, i + 1, barisKepala + 1, i + 1);
  });

  let kol = KOL_DASAR + 1;
  for (const o of orang) {
    const label = ROLE_JUDUL[o.peran] ?? o.peran;
    const cGrup = ws.getCell(barisKepala, kol);
    cGrup.value = `${o.nama}\n(${label})`;
    cGrup.font = headerFont();
    cGrup.fill = headerFill();
    cGrup.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cGrup.border = thinBorder();
    ws.mergeCells(barisKepala, kol, barisKepala, kol + 1);

    for (const [offset, teks] of [[0, '%'], [1, 'Rp']] as [number, string][]) {
      const c = ws.getCell(barisKepala + 1, kol + offset);
      c.value = teks;
      c.font = headerFont(9);
      c.fill = headerFill();
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder();
    }
    kol += 2;
  }

  const cKontrol = ws.getCell(barisKepala, kolKontrol);
  cKontrol.value = 'Kontrol';
  cKontrol.font = headerFont(9);
  cKontrol.fill = headerFill();
  cKontrol.alignment = { horizontal: 'center', vertical: 'middle' };
  cKontrol.border = thinBorder();
  ws.mergeCells(barisKepala, kolKontrol, barisKepala + 1, kolKontrol);

  row = barisKepala + 2;
  const barisDataAwal = row;

  projects.forEach((p, idx) => {
    const selang = idx % 2 === 1;
    const isiSelang: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
    const hiasi = (c: ExcelJS.Cell) => { c.border = thinBorder(); if (selang) c.fill = isiSelang; };

    const cNo = ws.getCell(row, 1);
    cNo.value = idx + 1;
    cNo.font = dataFont();
    cNo.alignment = { horizontal: 'center', vertical: 'middle' };
    hiasi(cNo);

    const cNama = ws.getCell(row, 2);
    cNama.value = p.project_name;
    cNama.font = dataFont();
    cNama.alignment = { vertical: 'middle', wrapText: true };
    hiasi(cNama);

    const cPool = ws.getCell(row, 3);
    cPool.value = p.incentive_value || 0;
    cPool.numFmt = '"Rp" #,##0';
    cPool.font = { ...dataFont(), bold: true };
    cPool.alignment = { horizontal: 'right', vertical: 'middle' };
    hiasi(cPool);

    const st = statusProyek(p.id);
    const cSt = ws.getCell(row, 4);
    cSt.value = proyeksi.has(p.id) ? `${st} (proyeksi)` : st;
    cSt.font = { ...dataFont(9), italic: proyeksi.has(p.id),
      color: { argb: st === 'Paid' ? '107C41' : proyeksi.has(p.id) ? 'B45309' : '1F4E79' } };
    cSt.alignment = { horizontal: 'center', vertical: 'middle' };
    hiasi(cSt);

    const perOrang = porsiPenuh.get(p.id);
    let k = KOL_DASAR + 1;
    let totalPersen = 0;
    for (const o of orang) {
      const bagian = perOrang?.get(o.nama);
      totalPersen += bagian?.persen ?? 0;

      const cPct = ws.getCell(row, k);
      cPct.value = bagian ? bagian.persen / 100 : null;
      cPct.numFmt = '0.0%';
      cPct.font = dataFont();
      cPct.alignment = { horizontal: 'center', vertical: 'middle' };
      hiasi(cPct);

      const cRp = ws.getCell(row, k + 1);
      cRp.value = bagian ? bagian.rupiah : null;
      cRp.numFmt = '"Rp" #,##0';
      cRp.font = dataFont();
      cRp.alignment = { horizontal: 'right', vertical: 'middle' };
      hiasi(cRp);

      k += 2;
    }

    //  Kontrol: 100% berarti seluruh pool menemukan penerimanya. Diberi warna
    //  merah bila tidak, sebab selisihnya adalah uang yang tidak dibayarkan
    //  ke siapa pun - dan itu jauh lebih mudah diperbaiki sekarang.
    const cK = ws.getCell(row, kolKontrol);
    cK.value = totalPersen / 100;
    cK.numFmt = '0%';
    cK.font = Math.abs(totalPersen - 100) < 0.5
      ? { ...dataFont(9), bold: true }
      : { ...dataFont(9), bold: true, color: { argb: 'C00000' } };
    cK.alignment = { horizontal: 'center', vertical: 'middle' };
    hiasi(cK);

    row++;
  });
  const barisDataAkhir = row - 1;

  // Total Finance
  const barisTotal = row;
  const cTotLabel = ws.getCell(barisTotal, 1);
  cTotLabel.value = 'Total Finance';
  cTotLabel.font = { ...dataFont(11), bold: true };
  cTotLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.mergeCells(barisTotal, 1, barisTotal, 2);
  cTotLabel.border = thinBorder();
  cTotLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  const cTotPool = ws.getCell(barisTotal, 3);
  cTotPool.value = sumCell(
    `SUM(C${barisDataAwal}:C${barisDataAkhir})`,
    projects.reduce((n, p) => n + (p.incentive_value || 0), 0),
  );
  cTotPool.numFmt = '"Rp" #,##0';
  cTotPool.font = { ...dataFont(11), bold: true };
  cTotPool.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotPool.border = thinBorder();
  cTotPool.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  let kt = KOL_DASAR + 1;
  for (const o of orang) {
    const kosong = ws.getCell(barisTotal, kt);
    kosong.border = thinBorder();
    kosong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const huruf = getColLetter(kt + 1);
    const cJml = ws.getCell(barisTotal, kt + 1);
    const totalOrang = projects.reduce((n, p) => n + (porsiPenuh.get(p.id)?.get(o.nama)?.rupiah ?? 0), 0);
    cJml.value = sumCell(`SUM(${huruf}${barisDataAwal}:${huruf}${barisDataAkhir})`, totalOrang);
    cJml.numFmt = '"Rp" #,##0';
    cJml.font = { ...dataFont(11), bold: true };
    cJml.alignment = { horizontal: 'right', vertical: 'middle' };
    cJml.border = thinBorder();
    cJml.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    kt += 2;
  }
  const cStTot = ws.getCell(barisTotal, 4);
  cStTot.border = thinBorder();
  cStTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  const cKTot = ws.getCell(barisTotal, kolKontrol);
  cKTot.border = thinBorder();
  cKTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  row += 2;

  if (proyeksi.size > 0) {
    const cCatatan = ws.getCell(row, 1);
    cCatatan.value = `Catatan: ${proyeksi.size} project bertanda "(proyeksi)" belum melewati Process Batch — `
      + 'angkanya dihitung dari skema yang berlaku saat berkas ini dibuat dan masih bisa berubah. '
      + 'Jalankan Process Batch untuk membekukannya.';
    cCatatan.font = { ...dataFont(9), italic: true, color: { argb: 'B45309' } };
    cCatatan.alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(row, 1, row, kolTerakhir);
    ws.getRow(row).height = 26;
    row += 2;
  }

  // TABEL 2 - kapan uangnya keluar
  const cJudul2 = ws.getCell(row, 1);
  cJudul2.value = 'Dan berikut adalah nilai pengajuan Incentive :';
  cJudul2.font = { ...dataFont(10), bold: true };
  ws.mergeCells(row, 1, row, kolTerakhir);
  row += 1;

  /*
    Uang tiap orang per TAHUN PEMBAYARAN.

    Dihitung dari porsi penuh (tabel 1) dikali persentase tahapan, lalu
    dijatuhkan ke payment_year tahapan itu. Tahunnya diambil dari tahapan yang
    benar-benar ada di basis data - bukan dari "tahun + 1, +2, +3" yang ditulis
    tangan - supaya rekap tetap benar bila jadwal tahapannya kelak diubah.

    Installer dikecualikan: porsinya lunas di tahun pertama, tidak dipecah.
  */
  const perTahun = new Map<string, Map<number, number>>();
  const tahunSet = new Set<number>();
  const installerLunasDiMuka = sk.installerBayarDiMuka;

  for (const p of projects) {
    const tahapProyek = tranches
      .filter(t => t.project_id === p.id)
      .sort((a, b) => a.tranche_number - b.tranche_number);
    if (tahapProyek.length === 0) continue;
    const tahunPertama = tahapProyek[0].payment_year;
    const totalPersenTahap = tahapProyek.reduce((n, t) => n + (t.percentage || 0), 0) || 100;

    const perOrang = porsiPenuh.get(p.id);
    if (!perOrang) continue;

    for (const [nama, bagian] of perOrang) {
      const ember = perTahun.get(nama) ?? new Map<number, number>();

      if (bagian.peran === 'installer' && installerLunasDiMuka) {
        tahunSet.add(tahunPertama);
        ember.set(tahunPertama, (ember.get(tahunPertama) ?? 0) + bagian.rupiah);
      } else {
        for (const t of tahapProyek) {
          tahunSet.add(t.payment_year);
          const nilai = Math.round((bagian.rupiah * (t.percentage || 0)) / totalPersenTahap);
          ember.set(t.payment_year, (ember.get(t.payment_year) ?? 0) + nilai);
        }
      }
      perTahun.set(nama, ember);
    }
  }

  const tahunUrut = Array.from(tahunSet).sort((a, b) => a - b);
  //  Persentase tahap per tahun, untuk kolom "%" - diambil dari tahapan mana
  //  pun yang jatuh di tahun itu; jadwalnya sama untuk semua proyek dalam satu
  //  rekap, jadi satu contoh sudah mewakili.
  const persenTahun = new Map<number, number>();
  for (const t of tranches) {
    if (!persenTahun.has(t.payment_year)) persenTahun.set(t.payment_year, t.percentage || 0);
  }

  const kepala2A = row, kepala2B = row + 1;
  const cNamaHdr = ws.getCell(kepala2A, 1);
  cNamaHdr.value = 'Nama';
  cNamaHdr.font = headerFont();
  cNamaHdr.fill = headerFill();
  cNamaHdr.alignment = { horizontal: 'center', vertical: 'middle' };
  cNamaHdr.border = thinBorder();
  ws.mergeCells(kepala2A, 1, kepala2B, 2);

  let k2 = 3;
  for (const th of tahunUrut) {
    const cTh = ws.getCell(kepala2A, k2);
    cTh.value = `dibayarkan tahun ${th}`;
    cTh.font = headerFont();
    cTh.fill = headerFill();
    cTh.alignment = { horizontal: 'center', vertical: 'middle' };
    cTh.border = thinBorder();
    ws.mergeCells(kepala2A, k2, kepala2A, k2 + 1);

    for (const [offset, teks] of [[0, '%'], [1, 'amount']] as [number, string][]) {
      const c = ws.getCell(kepala2B, k2 + offset);
      c.value = teks;
      c.font = headerFont(9);
      c.fill = headerFill();
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder();
    }
    k2 += 2;
  }
  row = kepala2B + 1;
  const baris2Awal = row;

  for (const o of orang) {
    const ember = perTahun.get(o.nama);
    const cNm = ws.getCell(row, 1);
    cNm.value = `${o.nama}${o.peran === 'installer' ? ' (Installer)' : ''}`;
    cNm.font = dataFont();
    cNm.alignment = { vertical: 'middle' };
    cNm.border = thinBorder();
    ws.mergeCells(row, 1, row, 2);

    let kk = 3;
    for (const th of tahunUrut) {
      const nilai = ember?.get(th) ?? 0;

      const cPct = ws.getCell(row, kk);
      //  Installer selalu 100% di tahun ia dibayar - porsinya tidak dipecah,
      //  jadi memakai persentase tahap di sini akan salah tulis.
      cPct.value = nilai === 0 ? null
        : (o.peran === 'installer' && installerLunasDiMuka ? 1 : (persenTahun.get(th) ?? 0) / 100);
      cPct.numFmt = '0%';
      cPct.font = dataFont(9);
      cPct.alignment = { horizontal: 'center', vertical: 'middle' };
      cPct.border = thinBorder();

      const cAmt = ws.getCell(row, kk + 1);
      cAmt.value = nilai || null;
      cAmt.numFmt = '#,##0';
      cAmt.font = dataFont();
      cAmt.alignment = { horizontal: 'right', vertical: 'middle' };
      cAmt.border = thinBorder();

      kk += 2;
    }
    row++;
  }
  const baris2Akhir = row - 1;

  const cTot2 = ws.getCell(row, 1);
  cTot2.value = 'Total';
  cTot2.font = { ...dataFont(), bold: true };
  cTot2.alignment = { horizontal: 'right', vertical: 'middle' };
  cTot2.border = thinBorder();
  cTot2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.mergeCells(row, 1, row, 2);

  let kj = 3;
  for (const th of tahunUrut) {
    const kosong = ws.getCell(row, kj);
    kosong.border = thinBorder();
    kosong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const huruf = getColLetter(kj + 1);
    const cJ = ws.getCell(row, kj + 1);
    const totalTahun = orang.reduce((n, o) => n + (perTahun.get(o.nama)?.get(th) ?? 0), 0);
    cJ.value = sumCell(`SUM(${huruf}${baris2Awal}:${huruf}${baris2Akhir})`, totalTahun);
    cJ.numFmt = '#,##0';
    cJ.font = { ...dataFont(), bold: true };
    cJ.alignment = { horizontal: 'right', vertical: 'middle' };
    cJ.border = thinBorder();
    cJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    kj += 2;
  }
  row += 2;

  // Tanda tangan
  const kota = 'Jakarta';
  const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  ws.getCell(row, 1).value = `${kota}, ${tgl}`;
  ws.getCell(row, 1).font = dataFont();
  row += 1;

  const kolomTtd: [number, string][] = [[1, 'Di buat oleh'], [4, 'Diperiksa Oleh'], [7, 'Menyetujui']];
  for (const [c, teks] of kolomTtd) {
    ws.getCell(row, c).value = teks;
    ws.getCell(row, c).font = dataFont();
  }
  row += 4;

  const namaTtd: [number, string, string][] = [
    [1, managerName, 'Manager PTS IVP'],
    [4, '', 'Finance'],
    [7, directorName, 'Director'],
  ];
  for (const [c, nama, jabatan] of namaTtd) {
    if (nama) {
      ws.getCell(row, c).value = `(${nama})`;
      ws.getCell(row, c).font = { ...dataFont(), bold: true };
    }
    ws.getCell(row + 1, c).value = jabatan;
    ws.getCell(row + 1, c).font = { ...dataFont(), italic: true };
  }

  // Lebar kolom
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 16;
  for (let c = KOL_DASAR + 1; c < kolKontrol; c++) {
    ws.getColumn(c).width = (c - KOL_DASAR) % 2 === 1 ? 8 : 16;
  }
  ws.getColumn(kolKontrol).width = 9;

  ws.views = [{ state: 'frozen', ySplit: barisKepala + 1, xSplit: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Pengajuan_Incentive_PTS_IVP_${year}.xlsx`);
}

// Summary Export (semua project, split dihitung on-the-fly)

/*
  REKAP SUMMARY - tema & susunan tabel mengikuti contoh yang diberikan
  langsung (bukan format bebas): navy #1F3864 untuk kepala tabel, biru muda
  #2E5395 untuk sub-kepala, abu-biru #D9E1F2 untuk baris TOTAL/GRAND TOTAL,
  kuning lembut #FFF2CC untuk baris Installer.

  TIGA tabel, dan masing-masing menjawab pertanyaan berbeda:

    1. List Project    - satu baris per proyek, tiap peran (PIC/Support/
                          Supervisor/Manager/Installer) mendapat TIGA kolom
                          sendiri (Nama, %, Rp) - bukan digabung jadi satu
                          sel teks. Kolom Rp memakai FORMULA (%  Nominal),
                          jadi kalau persennya dikoreksi manual di Excel,
                          rupiahnya ikut terhitung ulang sendiri.

    2. Summary Total per Anggota Team PTS - satu baris per ORANG (Installer
       tidak masuk sini - ia bukan bagian Team PTS, dibayar terpisah lunas
       di tahun pertama). Jumlah Project dan Total Nominal DIHITUNG DI
       JAVASCRIPT dari splits asli, bukan lewat COUNTIF/SUMIF yang membaca
       Tabel 1 - sebab Tabel 1 bisa menggabung beberapa Support jadi satu sel
       teks kalau lebih dari satu orang, dan formula pencarian nama akan
       melewatkan yang tidak tertulis literal di selnya sendiri. Menghitung
       di JavaScript dari sumbernya langsung tidak punya celah itu.

    3. Nilai Pengajuan Incentive per Tahun - porsi tiap orang dipecah ke
       TAHUN PEMBAYARAN sesungguhnya (BAST tiap proyek + Tahapan Pencairan),
       bukan tiga kolom tahun yang dipatok sama untuk semua orang - orang
       yang proyeknya berasal dari BAST berbeda akan punya tahun pembayaran
       yang berbeda pula, dan menyamaratakannya akan salah menaruh uang di
       tahun anggaran yang keliru.

  Installer TIDAK ikut dipecah ke tahapan: porsinya lunas 100% di tahun
  pertama proyeknya, ditandai kuning dan keterangan di sebelah namanya.
*/
export interface DataSummary {
  projects: IncentiveProjectRow[];
  allUsers: { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[];
  supportsMap: Map<string, { user_id: string; user_name: string }[]>;
  managerName: string;
  managerUserId: string;
}

/**
 * Susun workbook-nya saja - TANPA menyentuh basis data dan tanpa mengunduh.
 *
 * Dipisah dari exportSummaryIncentive supaya bentuk berkasnya bisa diperiksa
 * di luar peramban: skema diteruskan sebagai argumen (bukan dibaca sendiri
 * lewat Supabase) dan hasilnya dikembalikan (bukan langsung disimpan lewat
 * saveAs). Tanpa pemisahan ini satu-satunya cara memastikan tata letaknya
 * benar adalah mengunduh manual lalu membukanya - yang berarti tidak pernah
 * ada yang memeriksanya secara otomatis. Lihat uji/bentuk-summary-nyata.mjs.
 */
export async function bangunWorkbookSummary(data: DataSummary, sk: SkemaInsentif) {
  const { projects, allUsers, supportsMap, managerName, managerUserId } = data;
  const orgList = allUsers as unknown as OrgUser[];
  const tahapUrut = [...sk.tranche].sort((a, b) => a.nomor - b.nomor);
  const totalPersenTahap = tahapUrut.reduce((n, t) => n + (t.persen || 0), 0) || 100;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Summary Incentive PTS', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Warna tema - disalin dari contoh yang diberikan.
  const NAVY_HDR = '1F3864';
  const SUB_HDR = '2E5395';
  const TOTAL_FILL = 'D9E1F2';
  const INSTALLER_FILL = 'FFF2CC';
  const putih = (): Partial<ExcelJS.Font> => ({ bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Arial' });
  const fillWarna = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
  const RUPIAH_FMT = '#,##0;(#,##0);"-"';   // dash untuk nol - bukan sekadar kosong

  // Kolom A dibiarkan sebagai spasi tepi (lebar kecil), isi mulai kolom B -
  // menyamai contoh yang diberikan, bukan menempel ke tepi kiri kertas.
  const KOL = {
    no: 2, project: 3, mode: 4, bast: 5, nominal: 6,
    picNama: 7, picPct: 8, picRp: 9,
    suppNama: 10, suppPct: 11, suppRp: 12,
    supvNama: 13, supvPct: 14, supvRp: 15,
    mgrNama: 16, mgrPct: 17, mgrRp: 18,
    instNama: 19, instLokasi: 20, instPct: 21, instRp: 22,
  };
  const KOL_TERAKHIR = KOL.instRp; // 22 = V

  ws.getColumn(1).width = 3;
  ws.getColumn(KOL.no).width = 5;
  ws.getColumn(KOL.project).width = 30;
  ws.getColumn(KOL.mode).width = 10;
  ws.getColumn(KOL.bast).width = 13;
  ws.getColumn(KOL.nominal).width = 14;
  for (const c of [KOL.picNama, KOL.suppNama, KOL.supvNama, KOL.mgrNama, KOL.instNama]) ws.getColumn(c).width = 17;
  for (const c of [KOL.picPct, KOL.suppPct, KOL.supvPct, KOL.mgrPct, KOL.instPct]) ws.getColumn(c).width = 7;
  for (const c of [KOL.picRp, KOL.suppRp, KOL.supvRp, KOL.mgrRp, KOL.instRp]) ws.getColumn(c).width = 13;
  ws.getColumn(KOL.instLokasi).width = 12;

  let row = 2;

  /*
    Data proyek diproses SEKALI di sini, sebelum satu sel pun ditulis -
    supaya rentang tahun (untuk judul & Tabel 3) sudah diketahui lebih dulu,
    dan Tabel 1/2/3 semuanya membaca dari struktur yang sama persis, bukan
    dihitung ulang tiga kali dengan risiko saling menyimpang.
  */
  type Peran = { user_id: string; user_name: string; role: string; percentage: number; amount: number };
  type Proyek = {
    p: IncentiveProjectRow;
    hasNominal: boolean; isEstimate: boolean; pool: number; mode: 'onsite' | 'remote';
    pic: Peran[]; support: Peran[]; supervisor: Peran[]; manager: Peran[]; installer: Peran[];
    bastYear: number | null;
  };

  const daftarProyek: Proyek[] = projects.map(p => {
    const projectSupports = supportsMap.get(p.project_name) || [];
    const picId = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgList);
    const supUp = findUpline(picId, 'Supervisor', orgList);
    const mgrUp = findUpline(picId, 'Manager', orgList);
    const supervisorId   = (supUp?.id        || '') as string;
    const supervisorName = (supUp?.full_name || 'Supervisor') as string;
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerName;

    const hasNominal = (p.incentive_value || 0) > 0;
    const isEstimate = !hasNominal || !p.mode_penyelesaian;
    const pool = hasNominal ? p.incentive_value : 1_000_000;
    const mode: 'onsite' | 'remote' = p.mode_penyelesaian === 'remote' ? 'remote' : 'onsite';
    const displayProject = { ...p, incentive_value: pool, mode_penyelesaian: mode };
    const splits = calculateIncentiveSplits(sk, displayProject, projManagerId, projManagerName, supervisorId, supervisorName, projectSupports, picId) as Peran[];

    return {
      p, hasNominal, isEstimate, pool, mode,
      pic: splits.filter(s => s.role === 'pic'),
      support: splits.filter(s => s.role === 'support'),
      supervisor: splits.filter(s => s.role === 'supervisor'),
      manager: splits.filter(s => s.role === 'manager'),
      installer: splits.filter(s => s.role === 'installer'),
      bastYear: p.bast_date ? new Date(p.bast_date).getFullYear() : null,
    };
  });

  //  Akumulasi UANG SUNGGUHAN per orang - hanya proyek final (bukan estimasi),
  //  dipakai Tabel 2 & 3. Nama SETIAP orang dicatat terpisah (semuaNama),
  //  supaya yang seluruh proyeknya masih "belum input" tetap muncul di Tabel
  //  2 dengan total Rp 0 - bukan hilang begitu saja dari rekap.
  const akumulasi: { nama: string; peran: string; jumlah: number; bastYear: number }[] = [];
  const semuaNamaTim = new Map<string, Set<string>>();
  for (const pr of daftarProyek) {
    for (const s of [...pr.pic, ...pr.support, ...pr.supervisor, ...pr.manager]) {
      const nm = s.user_name || '—';
      const set = semuaNamaTim.get(nm) ?? new Set<string>();
      set.add(s.role);
      semuaNamaTim.set(nm, set);
      if (!pr.isEstimate && pr.bastYear) akumulasi.push({ nama: nm, peran: s.role, jumlah: s.amount, bastYear: pr.bastYear });
    }
  }

  const urutPeran: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3 };
  const perOrang = new Map<string, { nama: string; peran: Set<string>; total: number; jumlah: number }>();
  for (const { nama, peran, jumlah } of akumulasi) {
    const e = perOrang.get(nama) ?? { nama, peran: new Set<string>(), total: 0, jumlah: 0 };
    e.peran.add(peran); e.total += jumlah; e.jumlah += 1;
    perOrang.set(nama, e);
  }
  const namaBelumFinal = new Set<string>();
  for (const [nama, peranSet] of semuaNamaTim) {
    if (perOrang.has(nama)) continue;
    perOrang.set(nama, { nama, peran: new Set(peranSet), total: 0, jumlah: 0 });
    namaBelumFinal.add(nama);
  }
  const orangUrut = [...perOrang.values()].sort((a, b) => {
    const pa = Math.min(...[...a.peran].map(r => urutPeran[r] ?? 9));
    const pb = Math.min(...[...b.peran].map(r => urutPeran[r] ?? 9));
    return pa - pb || a.nama.localeCompare(b.nama, 'id');
  });

  //  Uang per orang per TAHUN PEMBAYARAN (Tim PTS) + Installer (lunas tahun pertama).
  const perOrangTahun = new Map<string, Map<number, number>>();
  const tahunSet = new Set<number>();
  for (const { nama, jumlah, bastYear } of akumulasi) {
    const ember = perOrangTahun.get(nama) ?? new Map<number, number>();
    for (const t of tahapUrut) {
      const th = bastYear + t.tahunKe;
      tahunSet.add(th);
      ember.set(th, (ember.get(th) ?? 0) + Math.round((jumlah * (t.persen || 0)) / totalPersenTahap));
    }
    perOrangTahun.set(nama, ember);
  }
  //  Installer: baris TERSENDIRI (bukan digabung ke perOrangTahun Tim PTS -
  //  perannya beda skema, disatukan nanti hanya saat dicetak).
  type BarisInstaller = { nama: string; lokasi: string; tahun: number; jumlah: number };
  const installerList: BarisInstaller[] = [];
  for (const pr of daftarProyek) {
    if (pr.isEstimate || !pr.bastYear) continue;
    for (const s of pr.installer) {
      const th = sk.installerBayarDiMuka ? pr.bastYear + (tahapUrut[0]?.tahunKe ?? 1) : pr.bastYear;
      tahunSet.add(th);
      installerList.push({ nama: s.user_name || '—', lokasi: pr.p.installer_daerah || '', tahun: th, jumlah: s.amount });
    }
  }
  const tahunUrut = [...tahunSet].sort((a, b) => a - b);
  const sufiksTahun = tahunUrut.length === 0 ? ''
    : tahunUrut.length === 1 ? ` Tahun ${tahunUrut[0]}`
    : ` Tahun ${tahunUrut[0]}–${tahunUrut[tahunUrut.length - 1]}`;

  // ── Judul ──────────────────────────────────────────────────────────────
  const cTitle = ws.getCell(row, KOL.no);
  cTitle.value = `Summary Incentive PTS IVP — Semua Project${sufiksTahun}`;
  cTitle.font = { bold: true, size: 14, name: 'Arial' };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  ws.getRow(row).height = 22;
  row += 1;

  const cGen = ws.getCell(row, KOL.no);
  cGen.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Dibuat oleh: ${managerName}`;
  cGen.font = { italic: true, size: 9, name: 'Arial', color: { argb: '666666' } };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 2;

  // ── TABEL 1 — List Project ───────────────────────────────────────────
  const cJudul1 = ws.getCell(row, KOL.no);
  cJudul1.value = '1. List Project';
  cJudul1.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const kepalaA = row, kepalaB = row + 1;
  const HDR_DASAR: [number, string][] = [
    [KOL.no, 'No'], [KOL.project, 'Project'], [KOL.mode, 'Mode'], [KOL.bast, 'BAST'], [KOL.nominal, 'Nominal (Rp)'],
  ];
  for (const [kolom, teks] of HDR_DASAR) {
    const c = ws.getCell(kepalaA, kolom);
    c.value = teks; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder();
    ws.mergeCells(kepalaA, kolom, kepalaB, kolom);
  }
  const GRUP_PERAN: [string, number, number][] = [
    ['PIC', KOL.picNama, KOL.picRp], ['Support', KOL.suppNama, KOL.suppRp],
    ['Supervisor', KOL.supvNama, KOL.supvRp], ['Manager', KOL.mgrNama, KOL.mgrRp],
  ];
  for (const [label, awal, akhir] of GRUP_PERAN) {
    const c = ws.getCell(kepalaA, awal);
    c.value = label; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
    ws.mergeCells(kepalaA, awal, kepalaA, akhir);
    for (const [off, sub] of [[0, 'Nama'], [1, '%'], [2, 'Rp']] as [number, string][]) {
      const s = ws.getCell(kepalaB, awal + off);
      s.value = sub; s.font = putih(); s.fill = fillWarna(SUB_HDR);
      s.alignment = { horizontal: 'center', vertical: 'middle' }; s.border = thinBorder();
    }
  }
  const cInst = ws.getCell(kepalaA, KOL.instNama);
  cInst.value = 'Installer'; cInst.font = putih(); cInst.fill = fillWarna(NAVY_HDR);
  cInst.alignment = { horizontal: 'center', vertical: 'middle' }; cInst.border = thinBorder();
  ws.mergeCells(kepalaA, KOL.instNama, kepalaA, KOL.instRp);
  for (const [off, sub] of [[0, 'Nama'], [1, 'Lokasi'], [2, '%'], [3, 'Rp']] as [number, string][]) {
    const s = ws.getCell(kepalaB, KOL.instNama + off);
    s.value = sub; s.font = putih(); s.fill = fillWarna(SUB_HDR);
    s.alignment = { horizontal: 'center', vertical: 'middle' }; s.border = thinBorder();
  }
  row = kepalaB + 1;
  const dataAwal = row;

  /** Sel Nama/%/Rp satu peran. >1 orang -> nama digabung, Rp dijumlah statis (bukan formula). */
  function tulisPeran(r: number, kolNama: number, orang: Peran[], baris: number, pool: number, isEstimate: boolean) {
    const cNama = ws.getCell(r, kolNama);
    const cPct = ws.getCell(r, kolNama + 1);
    const cRp = ws.getCell(r, kolNama + 2);
    [cNama, cPct, cRp].forEach(c => { c.border = thinBorder(); c.font = dataFont(); });
    cPct.numFmt = '0.0%'; cPct.alignment = { horizontal: 'center', vertical: 'middle' };
    cRp.numFmt = RUPIAH_FMT; cRp.alignment = { horizontal: 'right', vertical: 'middle' };
    cNama.alignment = { vertical: 'middle', wrapText: true };

    if (orang.length === 0) { cNama.value = '—'; return; }
    if (orang.length === 1) {
      const o = orang[0];
      cNama.value = o.user_name;
      cPct.value = o.percentage / 100;
      const hurufPct = getColLetter(kolNama + 1), hurufPool = getColLetter(KOL.nominal);
      cRp.value = isEstimate ? null
        : sumCell(`IF($${hurufPct}${baris}="","",$${hurufPool}${baris}*$${hurufPct}${baris})`, o.amount);
      if (isEstimate) { cNama.font = { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } }; cPct.value = null; }
      return;
    }
    // >1 orang pada peran yang sama - digabung, Rp dijumlah (statis, bukan formula).
    cNama.value = orang.map(o => `${o.user_name} (${(o.percentage).toFixed(1)}%)`).join('\n');
    cRp.value = isEstimate ? null : orang.reduce((n, o) => n + o.amount, 0);
    if (isEstimate) cNama.font = { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } };
  }

  daftarProyek.forEach((pr, idx) => {
    const r = dataAwal + idx;
    ws.getRow(r).height = 18;

    const cNo = ws.getCell(r, KOL.no); cNo.value = idx + 1; cNo.border = thinBorder();
    cNo.alignment = { horizontal: 'center', vertical: 'middle' }; cNo.font = dataFont();

    const cProj = ws.getCell(r, KOL.project); cProj.value = pr.p.project_name; cProj.border = thinBorder();
    cProj.alignment = { vertical: 'middle', wrapText: true }; cProj.font = dataFont();

    const cMode = ws.getCell(r, KOL.mode); cMode.value = pr.mode === 'remote' ? 'Remote' : 'Onsite';
    cMode.border = thinBorder(); cMode.alignment = { vertical: 'middle' }; cMode.font = dataFont();

    const cBast = ws.getCell(r, KOL.bast);
    cBast.value = pr.p.bast_date
      ? new Date(pr.p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'belum input';
    cBast.border = thinBorder(); cBast.alignment = { vertical: 'middle' };
    cBast.font = pr.p.bast_date ? dataFont() : { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } };

    const cNom = ws.getCell(r, KOL.nominal);
    cNom.value = pr.hasNominal ? pr.pool : null;
    cNom.numFmt = RUPIAH_FMT; cNom.border = thinBorder();
    cNom.alignment = { horizontal: 'right', vertical: 'middle' };
    cNom.font = pr.hasNominal ? { ...dataFont(), bold: true } : { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } };
    if (!pr.hasNominal) cNom.value = 'belum input';

    tulisPeran(r, KOL.picNama, pr.pic, r, pr.pool, pr.isEstimate);
    tulisPeran(r, KOL.suppNama, pr.support, r, pr.pool, pr.isEstimate);
    tulisPeran(r, KOL.supvNama, pr.supervisor, r, pr.pool, pr.isEstimate);
    tulisPeran(r, KOL.mgrNama, pr.manager, r, pr.pool, pr.isEstimate);

    // Installer - 4 kolom (Nama, Lokasi, %, Rp), bukan 3 seperti peran lain.
    const cIN = ws.getCell(r, KOL.instNama), cIL = ws.getCell(r, KOL.instLokasi);
    const cIP = ws.getCell(r, KOL.instPct), cIR = ws.getCell(r, KOL.instRp);
    [cIN, cIL, cIP, cIR].forEach(c => { c.border = thinBorder(); c.font = dataFont(); });
    cIP.numFmt = '0.0%'; cIP.alignment = { horizontal: 'center', vertical: 'middle' };
    cIR.numFmt = RUPIAH_FMT; cIR.alignment = { horizontal: 'right', vertical: 'middle' };
    if (pr.installer.length === 0) { cIN.value = '—'; }
    else {
      const o = pr.installer[0];
      cIN.value = o.user_name; cIL.value = pr.p.installer_daerah || '—';
      cIP.value = pr.isEstimate ? null : o.percentage / 100;
      cIR.value = pr.isEstimate ? null : sumCell(
        `IF($${getColLetter(KOL.instPct)}${r}="","",$${getColLetter(KOL.nominal)}${r}*$${getColLetter(KOL.instPct)}${r})`, o.amount,
      );
    }
  });
  const dataAkhir = dataAwal + daftarProyek.length - 1;
  row = dataAkhir + 1;

  // TOTAL - hanya kolom Nominal yang dijumlah; menjumlah nama/persen tidak berarti apa-apa.
  const cLabelTot = ws.getCell(row, KOL.no);
  cLabelTot.value = 'TOTAL'; cLabelTot.font = { ...dataFont(), bold: true }; cLabelTot.fill = fillWarna(TOTAL_FILL);
  cLabelTot.border = thinBorder(); cLabelTot.alignment = { vertical: 'middle' };
  ws.mergeCells(row, KOL.no, row, KOL.bast);
  for (let c = KOL.no + 1; c <= KOL.bast; c++) { const x = ws.getCell(row, c); x.fill = fillWarna(TOTAL_FILL); x.border = thinBorder(); }
  const totalNominal = daftarProyek.reduce((n, pr) => n + (pr.hasNominal ? pr.pool : 0), 0);
  const cTotNom = ws.getCell(row, KOL.nominal);
  cTotNom.value = sumCell(`SUM(${getColLetter(KOL.nominal)}${dataAwal}:${getColLetter(KOL.nominal)}${dataAkhir})`, totalNominal);
  cTotNom.numFmt = RUPIAH_FMT; cTotNom.font = { ...dataFont(), bold: true }; cTotNom.fill = fillWarna(TOTAL_FILL);
  cTotNom.border = thinBorder(); cTotNom.alignment = { horizontal: 'right', vertical: 'middle' };
  for (let c = KOL.picNama; c <= KOL_TERAKHIR; c++) { const x = ws.getCell(row, c); x.fill = fillWarna(TOTAL_FILL); x.border = thinBorder(); }
  row += 1;

  const cFoot1 = ws.getCell(row, KOL.no);
  cFoot1.value = '* Kolom % dan Rp tiap peran dihitung otomatis dari Nominal (Rp) × %. Baris "belum input" berarti nominal proyek belum diisi Admin - '
    + 'persen & rupiahnya tidak dihitung sampai diisi. Installer tercatat di sini tapi TIDAK termasuk Team PTS - lihat Tabel 2 & 3.';
  cFoot1.font = { italic: true, size: 8, name: 'Arial', color: { argb: '808080' } };
  cFoot1.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  ws.getRow(row).height = 24;
  row += 2;

  // ── TABEL 2 — Summary Total per Anggota Team PTS ─────────────────────
  const cJudul2 = ws.getCell(row, KOL.no);
  cJudul2.value = '2. Summary Total per Anggota Team PTS (PIC / Support / Supervisor / Manager)';
  cJudul2.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const roleLabel = (r: string) => r === 'pic' ? 'PIC' : r === 'support' ? 'Support' : r === 'supervisor' ? 'Supervisor' : 'Manager';
  const HDR2: [number, string][] = [[KOL.no, 'Nama'], [KOL.project, 'Role'], [KOL.mode, 'Jumlah Project'], [KOL.bast, 'Total Nominal (Rp)']];
  for (const [kolom, teks] of HDR2) {
    const c = ws.getCell(row, kolom);
    c.value = teks; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = thinBorder();
  }
  row += 1;
  const t2Awal = row;
  orangUrut.forEach(o => {
    const belumFinal = namaBelumFinal.has(o.nama);
    const cN = ws.getCell(row, KOL.no); cN.value = o.nama; cN.border = thinBorder();
    cN.alignment = { vertical: 'middle', wrapText: true };
    cN.font = belumFinal ? { ...dataFont(), italic: true, color: { argb: '999999' } } : dataFont();
    const cR = ws.getCell(row, KOL.project);
    cR.value = [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9)).map(roleLabel).join(', ');
    cR.border = thinBorder(); cR.font = dataFont(); cR.alignment = { vertical: 'middle' };
    const cJ = ws.getCell(row, KOL.mode); cJ.value = o.jumlah; cJ.border = thinBorder();
    cJ.alignment = { horizontal: 'center', vertical: 'middle' }; cJ.font = dataFont();
    const cT = ws.getCell(row, KOL.bast); cT.value = o.total; cT.numFmt = RUPIAH_FMT; cT.border = thinBorder();
    cT.alignment = { horizontal: 'right', vertical: 'middle' }; cT.font = { ...dataFont(), bold: true };
    if (belumFinal) { cJ.font = { ...dataFont(), color: { argb: '999999' } }; cT.font = { ...dataFont(), bold: true, color: { argb: '999999' } }; }
    row += 1;
  });
  const t2Akhir = row - 1;
  if (orangUrut.length === 0) {
    ws.getCell(row, KOL.no).value = '(Belum ada project)';
    ws.getCell(row, KOL.no).font = { ...dataFont(), italic: true, color: { argb: '999999' } };
    ws.mergeCells(row, KOL.no, row, KOL.bast);
    row += 1;
  }
  const cGT2 = ws.getCell(row, KOL.no);
  cGT2.value = 'GRAND TOTAL'; cGT2.font = { ...dataFont(), bold: true }; cGT2.fill = fillWarna(TOTAL_FILL); cGT2.border = thinBorder();
  ws.mergeCells(row, KOL.no, row, KOL.mode);
  for (let c = KOL.no + 1; c <= KOL.mode; c++) { const x = ws.getCell(row, c); x.fill = fillWarna(TOTAL_FILL); x.border = thinBorder(); }
  const cGT2v = ws.getCell(row, KOL.bast);
  cGT2v.value = orangUrut.length ? sumCell(`SUM(${getColLetter(KOL.bast)}${t2Awal}:${getColLetter(KOL.bast)}${t2Akhir})`,
    orangUrut.reduce((n, o) => n + o.total, 0)) : 0;
  cGT2v.numFmt = RUPIAH_FMT; cGT2v.font = { ...dataFont(), bold: true }; cGT2v.fill = fillWarna(TOTAL_FILL);
  cGT2v.border = thinBorder(); cGT2v.alignment = { horizontal: 'right', vertical: 'middle' };
  row += 2;

  // ── TABEL 3 — Nilai Pengajuan Incentive per Tahun ────────────────────
  const cJudul3 = ws.getCell(row, KOL.no);
  cJudul3.value = '3. Nilai Pengajuan Incentive per Tahun';
  cJudul3.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const cFoot3 = ws.getCell(row, KOL.no);
  const labelTahap = tahapUrut.map(t => `${t.persen}% (thn ke-${t.tahunKe})`).join(' / ');
  cFoot3.value = `Team PTS dipecah per Tahapan Pencairan: ${labelTahap}, dihitung dari BAST masing-masing proyek - `
    + 'bukan tahun kalender yang sama untuk semua orang. Installer dibayar 100% di tahun pertama proyeknya, tidak ikut dipecah.';
  cFoot3.font = { italic: true, size: 8, name: 'Arial', color: { argb: '808080' } };
  cFoot3.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  ws.getRow(row).height = 22;
  row += 1;

  const k3A = row, k3B = row + 1;
  const cNamaH = ws.getCell(k3A, KOL.no); cNamaH.value = 'Nama'; cNamaH.font = putih(); cNamaH.fill = fillWarna(NAVY_HDR);
  cNamaH.alignment = { horizontal: 'center', vertical: 'middle' }; cNamaH.border = thinBorder();
  ws.mergeCells(k3A, KOL.no, k3B, KOL.no);
  const cPeranH = ws.getCell(k3A, KOL.project); cPeranH.value = 'Peran'; cPeranH.font = putih(); cPeranH.fill = fillWarna(NAVY_HDR);
  cPeranH.alignment = { horizontal: 'center', vertical: 'middle' }; cPeranH.border = thinBorder();
  ws.mergeCells(k3A, KOL.project, k3B, KOL.project);

  let kh = KOL.mode;
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
    ws.getColumn(kh).width = 8; ws.getColumn(kh + 1).width = 14;
    kh += 2;
  }
  const kolTotal3 = kh;
  const cTotH3 = ws.getCell(k3A, kolTotal3);
  cTotH3.value = 'Total'; cTotH3.font = putih(); cTotH3.fill = fillWarna(NAVY_HDR);
  cTotH3.alignment = { horizontal: 'center', vertical: 'middle' }; cTotH3.border = thinBorder();
  ws.mergeCells(k3A, kolTotal3, k3B, kolTotal3);
  ws.getColumn(kolTotal3).width = 14;
  row = k3B + 1;
  const t3Awal = row;

  orangUrut.forEach(o => {
    const belumFinal = namaBelumFinal.has(o.nama);
    const cN = ws.getCell(row, KOL.no); cN.value = o.nama; cN.border = thinBorder();
    cN.alignment = { vertical: 'middle', wrapText: true };
    cN.font = belumFinal ? { ...dataFont(), italic: true, color: { argb: '999999' } } : dataFont();
    const cR = ws.getCell(row, KOL.project);
    cR.value = [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9)).map(roleLabel).join(', ');
    cR.border = thinBorder(); cR.font = dataFont(); cR.alignment = { vertical: 'middle' };

    const ember = perOrangTahun.get(o.nama);
    let kk = KOL.mode;
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

  // Baris Installer - kuning, satu tahun terisi (100%), sisanya kosong.
  installerList.forEach(inst => {
    const r = row;
    ws.getRow(r).height = 30;
    const cN = ws.getCell(r, KOL.no);
    cN.value = `${inst.nama}${inst.lokasi ? ' · ' + inst.lokasi : ''}  (Installer — 100% pencairan tahun pertama)`;
    cN.font = dataFont(); cN.fill = fillWarna(INSTALLER_FILL); cN.border = thinBorder();
    cN.alignment = { vertical: 'middle', wrapText: true };
    const cR = ws.getCell(r, KOL.project);
    cR.value = 'Installer'; cR.font = dataFont(); cR.fill = fillWarna(INSTALLER_FILL); cR.border = thinBorder();
    cR.alignment = { vertical: 'middle' };

    let kk = KOL.mode; let kolAmt = -1;
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
  const t3Akhir = row - 1;

  if (orangUrut.length === 0 && installerList.length === 0) {
    ws.getCell(row, KOL.no).value = '(Belum ada project dengan nominal & mode final)';
    ws.getCell(row, KOL.no).font = { ...dataFont(), italic: true, color: { argb: '999999' } };
    ws.mergeCells(row, KOL.no, row, kolTotal3);
    row += 1;
  }

  const cGT3 = ws.getCell(row, KOL.no);
  cGT3.value = 'GRAND TOTAL'; cGT3.font = { ...dataFont(), bold: true }; cGT3.fill = fillWarna(TOTAL_FILL); cGT3.border = thinBorder();
  ws.mergeCells(row, KOL.no, row, KOL.project);
  const cGT3b = ws.getCell(row, KOL.project); cGT3b.fill = fillWarna(TOTAL_FILL); cGT3b.border = thinBorder();
  let kg = KOL.mode;
  for (const _th of tahunUrut) {
    const cKosong = ws.getCell(row, kg); cKosong.fill = fillWarna(TOTAL_FILL); cKosong.border = thinBorder();
    const kolAmt = kg + 1;
    const huruf = getColLetter(kolAmt);
    const cJ = ws.getCell(row, kolAmt);
    // Jumlahkan nilai riil dari baris-baris di atas (bukan formula SUM saja),
    // supaya cache hasilnya benar walau ada baris kosong di antaranya.
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
  row += 3;

  // ── Tanggal & tanda tangan ────────────────────────────────────────────
  ws.getCell(row, KOL.no).value = `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  ws.getCell(row, KOL.no).font = dataFont();
  row += 2;

  const ttdKolom = [KOL.no, KOL.suppNama, KOL.mgrNama];
  const ttdLabel = ['Di buat oleh,', 'Diperiksa Oleh,', 'Menyetujui,'];
  ttdKolom.forEach((c, i) => { ws.getCell(row, c).value = ttdLabel[i]; ws.getCell(row, c).font = dataFont(); });
  row += 4;
  const ttdNama: (string | null)[] = [managerName, null, null];
  const ttdJabatan = ['Manager PTS IVP', 'Finance', 'Director'];
  ttdKolom.forEach((c, i) => {
    if (ttdNama[i]) {
      ws.getCell(row, c).value = `( ${ttdNama[i]} )`;
      ws.getCell(row, c).font = { ...dataFont(), bold: true, underline: true };
    } else {
      ws.getCell(row, c).value = '(                    )';
      ws.getCell(row, c).font = dataFont();
    }
    ws.getCell(row + 1, c).value = ttdJabatan[i];
    ws.getCell(row + 1, c).font = { ...dataFont(), italic: true };
  });

  ws.views = [{ state: 'frozen', ySplit: kepalaB, xSplit: 0 }];

  return wb;
}

/** Baca skema, susun workbook-nya, lalu unduh. Dipanggil tombol Export Summary. */
export async function exportSummaryIncentive(data: DataSummary) {
  const sk = await ambilSkema();
  const wb = await bangunWorkbookSummary(data, sk);
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
