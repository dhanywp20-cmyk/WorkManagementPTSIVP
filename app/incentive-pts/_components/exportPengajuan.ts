'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  IncentiveProjectRow, IncentiveSplit, IncentiveTranche,
  SplitResult, formatRupiah, formatPct,
  calculateIncentiveSplits, findUpline, resolveUserId, OrgUser, ambilSkema, labelSkema,
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
  cTotPool.value = { formula: `SUM(C${barisDataAwal}:C${barisDataAkhir})` };
  cTotPool.numFmt = '"Rp" #,##0';
  cTotPool.font = { ...dataFont(11), bold: true };
  cTotPool.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotPool.border = thinBorder();
  cTotPool.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  let kt = KOL_DASAR + 1;
  for (const _o of orang) {
    const kosong = ws.getCell(barisTotal, kt);
    kosong.border = thinBorder();
    kosong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const huruf = getColLetter(kt + 1);
    const cJml = ws.getCell(barisTotal, kt + 1);
    cJml.value = { formula: `SUM(${huruf}${barisDataAwal}:${huruf}${barisDataAkhir})` };
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
  for (const _th of tahunUrut) {
    const kosong = ws.getCell(row, kj);
    kosong.border = thinBorder();
    kosong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const huruf = getColLetter(kj + 1);
    const cJ = ws.getCell(row, kj + 1);
    cJ.value = { formula: `SUM(${huruf}${baris2Awal}:${huruf}${baris2Akhir})` };
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
  /*
    Satu catatan per (orang, peran, proyek) - BUKAN total yang sudah dijumlah.

    Tahun pencairan bergantung pada BAST proyeknya masing-masing, jadi
    menjumlahkan lebih dulu akan menghapus keterangan yang justru dibutuhkan
    untuk memecahnya ke tahun. Penjumlahannya dilakukan belakangan, sesudah
    tiap catatan menemukan tahunnya sendiri.
  */
  const akumulasi: { nama: string; peran: string; jumlah: number; bastYear: number }[] = [];

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
  ws.mergeCells(row, 1, row, 10);
  ws.getRow(row).height = 28;
  row++;

  const genCell = ws.getCell(row, 1);
  genCell.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Dibuat oleh: ${managerName}`;
  genCell.font = { italic: true, size: 9, name: 'Arial', color: { argb: '888888' } };
  ws.mergeCells(row, 1, row, 10);
  row += 2;

  // Column headers
  /*
    Handler & Kategori sengaja TIDAK ada di sini.

    Handler selalu sama dengan nama di kolom PIC - menuliskannya dua kali
    membuat lembar makin lebar tanpa menambah satu pun keterangan baru.
    Kategori tidak dipakai membaca rekap: satu proyek yang punya Konfigurasi
    dan Training sudah disatukan jadi satu baris sebelum sampai ke sini
    (lihat lib/kelompok-insentif.ts), jadi kolom itu justru mengesankan ada
    pembedaan yang sebenarnya sudah tidak berlaku.
  */
  const COLS = [
    { h: 'No',            w: 5  },
    { h: 'Project',       w: 38 },
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
  //  Indeks (0-based) kolom Nominal di rowData. Dipakai sebagai patokan, bukan
  //  angka 6 yang ditulis tangan - kolom di kiri sempat berubah jumlahnya, dan
  //  angka tetap membuat pemformatan menempel di kolom yang salah tanpa gagal.
  const KOL_NOMINAL = 4;

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
    const splits = calculateIncentiveSplits(sk, displayProject, projManagerId, projManagerName, supervisorId, supervisorName, projectSupports, picId);
    const isEstimate = !hasNominal || !p.mode_penyelesaian;

    // Akumulasi total per orang - hanya project final (ada nominal & mode), pakai amount asli
    if (!isEstimate && p.bast_date) {
      const bastYear = new Date(p.bast_date).getFullYear();
      for (const s of splits) {
        akumulasi.push({
          nama: s.user_name || '—', peran: s.role, jumlah: s.amount, bastYear,
        });
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
      cell.font = i === KOL_NOMINAL ? { ...dataFont(), bold: true } : dataFont();
      cell.border = thinBorder();
      if (isAlt) cell.fill = altFill;
      if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (i === KOL_NOMINAL) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (!hasNominal) {
          cell.font = { ...dataFont(), italic: true, color: { argb: 'BBBBBB' } };
          cell.value = 'belum input';
        }
      } else if (i > KOL_NOMINAL) {
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
  ws.mergeCells(totRow, 1, totRow, KOL_NOMINAL);
  ws.getCell(totRow, KOL_NOMINAL + 1).value = { formula: `SUM(E${dataStart}:E${dataEnd})` };
  ws.getCell(totRow, KOL_NOMINAL + 1).numFmt = '#,##0';
  ws.getCell(totRow, KOL_NOMINAL + 1).font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell(totRow, KOL_NOMINAL + 1).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(totRow, KOL_NOMINAL + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  ws.getCell(totRow, KOL_NOMINAL + 1).border = thinBorder();
  for (let c = KOL_NOMINAL + 2; c <= COLS.length; c++) {
    ws.getCell(totRow, c).border = thinBorder();
    ws.getCell(totRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  }

  // Estimate note
  row = totRow + 2;
  ws.getCell(row, 1).value = '* Estimasi: ditampilkan jika nominal belum diinput atau mode penyelesaian belum diset (default Onsite). Angka rupiah tidak tertera.';
  ws.getCell(row, 1).font = { italic: true, size: 9, name: 'Arial', color: { argb: 'BBBB44' } };
  ws.mergeCells(row, 1, row, 10);

  /*
    REKAPITULASI PER ORANG - satu baris per NAMA, bukan per nama+peran.

    Bentuk sebelumnya memisahkan tiap peran jadi barisnya sendiri, sehingga
    orang yang menjadi PIC di satu proyek dan Supervisor di proyek lain muncul
    dua kali dengan dua angka. Yang perlu diketahui Finance adalah satu angka:
    berapa yang harus ditransfer ke orang itu. Peran-perannya tetap dicetak
    sebagai keterangan, tapi tidak lagi memecah barisnya.

    Uangnya lalu dipecah ke TAHUN PEMBAYARAN, mengikuti Tahapan Pencairan -
    inilah yang membuat rekap ini bisa langsung dipakai mengajukan ke Finance,
    bukan cuma daftar total yang masih harus dihitung ulang per tahun.

    Installer TIDAK ikut dipecah: porsinya lunas di tahun pertama proyeknya.
  */
  row += 2;
  const rpTitle = ws.getCell(row, 1);
  rpTitle.value = 'Dan berikut adalah nilai pengajuan Incentive :';
  rpTitle.font = { bold: true, size: 12, name: 'Arial', color: { argb: NAVY } };
  ws.mergeCells(row, 1, row, 10);
  row++;
  const rpSub = ws.getCell(row, 1);
  rpSub.value = 'Akumulasi seluruh project dgn nominal & mode final (estimasi tidak dihitung). '
    + 'Nominal tiap orang dipecah ke tahun pencairannya menurut Tahapan Pencairan; '
    + 'Installer dibayar 100% di tahun pertama.';
  rpSub.font = { italic: true, size: 9, name: 'Arial', color: { argb: '888888' } };
  rpSub.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(row, 1, row, 10);
  ws.getRow(row).height = 24;
  row += 1;

  /*
    Uang per orang per tahun.

    Tahun diambil dari BAST tiap proyek + tahunKe tahapan, jadi proyek dengan
    BAST berbeda jatuh ke tahun yang berbeda pula - rekap ini memuat SEMUA
    proyek, bukan satu angkatan saja, dan menyamaratakan tahunnya akan
    menempatkan uang di tahun anggaran yang keliru.
  */
  const perOrangTahun = new Map<string, { nama: string; peran: Set<string>; tahun: Map<number, number>; total: number }>();
  const tahunSet = new Set<number>();
  const tahapUrut = [...sk.tranche].sort((a, b) => a.nomor - b.nomor);
  const totalPersenTahap = tahapUrut.reduce((n, t) => n + (t.persen || 0), 0) || 100;

  for (const { nama, peran, jumlah, bastYear } of akumulasi) {
    const ember = perOrangTahun.get(nama)
      ?? { nama, peran: new Set<string>(), tahun: new Map<number, number>(), total: 0 };
    ember.peran.add(peran);
    ember.total += jumlah;

    if (peran === 'installer' && sk.installerBayarDiMuka) {
      const th = bastYear + (tahapUrut[0]?.tahunKe ?? 1);
      tahunSet.add(th);
      ember.tahun.set(th, (ember.tahun.get(th) ?? 0) + jumlah);
    } else {
      for (const t of tahapUrut) {
        const th = bastYear + t.tahunKe;
        tahunSet.add(th);
        const nilai = Math.round((jumlah * (t.persen || 0)) / totalPersenTahap);
        ember.tahun.set(th, (ember.tahun.get(th) ?? 0) + nilai);
      }
    }
    perOrangTahun.set(nama, ember);
  }

  const tahunUrut = [...tahunSet].sort((a, b) => a - b);

  // Kepala tabel: Nama | (per tahun: % + amount) | Total
  const kepA = row, kepB = row + 1;
  const cNamaH = ws.getCell(kepA, 1);
  cNamaH.value = 'Nama';
  cNamaH.font = headerFont(10);
  cNamaH.fill = headerFill();
  cNamaH.alignment = { horizontal: 'center', vertical: 'middle' };
  cNamaH.border = thinBorder();
  ws.mergeCells(kepA, 1, kepB, 2);

  let kh = 3;
  for (const th of tahunUrut) {
    const cTh = ws.getCell(kepA, kh);
    cTh.value = `dibayarkan tahun ${th}`;
    cTh.font = headerFont(10);
    cTh.fill = headerFill();
    cTh.alignment = { horizontal: 'center', vertical: 'middle' };
    cTh.border = thinBorder();
    ws.mergeCells(kepA, kh, kepA, kh + 1);
    for (const [off, teks] of [[0, '%'], [1, 'amount']] as [number, string][]) {
      const c = ws.getCell(kepB, kh + off);
      c.value = teks;
      c.font = headerFont(9);
      c.fill = headerFill();
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder();
    }
    ws.getColumn(kh).width = 8;
    ws.getColumn(kh + 1).width = 16;
    kh += 2;
  }
  const kolTotal = kh;
  const cTotH = ws.getCell(kepA, kolTotal);
  cTotH.value = 'Total';
  cTotH.font = headerFont(10);
  cTotH.fill = headerFill();
  cTotH.alignment = { horizontal: 'center', vertical: 'middle' };
  cTotH.border = thinBorder();
  ws.mergeCells(kepA, kolTotal, kepB, kolTotal);
  ws.getColumn(kolTotal).width = 18;

  row = kepB + 1;
  const pStart = row;

  const urutPeran: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3, installer: 4 };
  const orangUrut = [...perOrangTahun.values()].sort((a, b) => {
    const pa = Math.min(...[...a.peran].map(r => urutPeran[r] ?? 9));
    const pb = Math.min(...[...b.peran].map(r => urutPeran[r] ?? 9));
    return pa - pb || a.nama.localeCompare(b.nama, 'id');
  });

  orangUrut.forEach((o, idx) => {
    const selang = idx % 2 === 1;
    const isiSelang: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F9FA' } };
    const hiasi = (c: ExcelJS.Cell) => { c.border = thinBorder(); if (selang) c.fill = isiSelang; };
    const hanyaInstaller = o.peran.size === 1 && o.peran.has('installer');

    const cNm = ws.getCell(row, 1);
    const daftarPeran = [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9))
      .map(r => ROLE_JUDUL[r] ?? r).join(', ');
    cNm.value = `${o.nama}  (${daftarPeran}${hanyaInstaller ? ' — 100% pencairan tahun pertama' : ''})`;
    cNm.font = dataFont();
    cNm.alignment = { vertical: 'middle', wrapText: true };
    hiasi(cNm);
    ws.mergeCells(row, 1, row, 2);
    const cNm2 = ws.getCell(row, 2);
    hiasi(cNm2);

    let kk = 3;
    for (const th of tahunUrut) {
      const nilai = o.tahun.get(th) ?? 0;

      //  Persennya DIHITUNG dari nominalnya sendiri, bukan disalin dari
      //  persentase tahapan. Rekap ini memuat proyek dari beberapa angkatan
      //  BAST sekaligus, jadi satu tahun kalender bisa berisi tahap 1 proyek
      //  A sekaligus tahap 2 proyek B - satu angka tahapan tidak akan benar
      //  untuk keduanya. Membaginya dengan total orang itu selalu benar, dan
      //  pada rekap satu angkatan hasilnya persis 50/35/15.
      const cPct = ws.getCell(row, kk);
      cPct.value = nilai && o.total ? nilai / o.total : null;
      cPct.numFmt = '0%';
      cPct.font = dataFont(9);
      cPct.alignment = { horizontal: 'center', vertical: 'middle' };
      hiasi(cPct);

      const cAmt = ws.getCell(row, kk + 1);
      cAmt.value = nilai || null;
      cAmt.numFmt = '#,##0';
      cAmt.font = dataFont();
      cAmt.alignment = { horizontal: 'right', vertical: 'middle' };
      hiasi(cAmt);
      kk += 2;
    }

    const cTot = ws.getCell(row, kolTotal);
    cTot.value = o.total;
    cTot.numFmt = '#,##0';
    cTot.font = { ...dataFont(), bold: true };
    cTot.alignment = { horizontal: 'right', vertical: 'middle' };
    hiasi(cTot);

    row++;
  });
  const pEnd = row - 1;

  if (orangUrut.length === 0) {
    ws.getCell(row, 1).value = '(Belum ada project dengan nominal & mode final)';
    ws.getCell(row, 1).font = { ...dataFont(), italic: true, color: { argb: '999999' } };
    ws.mergeCells(row, 1, row, kolTotal);
    row++;
  }

  // GRAND TOTAL
  const gRow = row;
  const cG = ws.getCell(gRow, 1);
  cG.value = 'GRAND TOTAL';
  cG.font = { bold: true, size: 10, name: 'Arial' };
  cG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  cG.alignment = { horizontal: 'right', vertical: 'middle' };
  cG.border = thinBorder();
  ws.mergeCells(gRow, 1, gRow, 2);
  ws.getCell(gRow, 2).border = thinBorder();
  ws.getCell(gRow, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  let kg = 3;
  for (const _th of tahunUrut) {
    const kosong = ws.getCell(gRow, kg);
    kosong.border = thinBorder();
    kosong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    const huruf = getColLetter(kg + 1);
    const cJ = ws.getCell(gRow, kg + 1);
    cJ.value = orangUrut.length ? { formula: `SUM(${huruf}${pStart}:${huruf}${pEnd})` } : 0;
    cJ.numFmt = '#,##0';
    cJ.font = { bold: true, size: 10, name: 'Arial' };
    cJ.alignment = { horizontal: 'right', vertical: 'middle' };
    cJ.border = thinBorder();
    cJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    kg += 2;
  }
  const hurufTot = getColLetter(kolTotal);
  const cGT = ws.getCell(gRow, kolTotal);
  cGT.value = orangUrut.length ? { formula: `SUM(${hurufTot}${pStart}:${hurufTot}${pEnd})` } : 0;
  cGT.numFmt = '#,##0';
  cGT.font = { bold: true, size: 10, name: 'Arial' };
  cGT.alignment = { horizontal: 'right', vertical: 'middle' };
  cGT.border = thinBorder();
  cGT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  row = gRow + 3;

  // Tanggal & tanda tangan - lembar ini diserahkan ke Finance, jadi harus
  // bisa dicetak dan ditandatangani apa adanya tanpa disunting dulu.
  ws.getCell(row, 1).value = `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  ws.getCell(row, 1).font = dataFont();
  row += 2;

  const ttd: [number, string][] = [[1, 'Di buat oleh,'], [4, 'Diperiksa Oleh,'], [7, 'Menyetujui,']];
  for (const [c, teks] of ttd) {
    ws.getCell(row, c).value = teks;
    ws.getCell(row, c).font = dataFont();
  }
  row += 4;

  const namaTtd: [number, string, string][] = [
    [1, managerName, 'Manager PTS IVP'],
    [4, '', 'Finance'],
    [7, 'Director PT. IVP', 'Director'],
  ];
  for (const [c, nama, jabatan] of namaTtd) {
    if (nama) {
      ws.getCell(row, c).value = `(${nama})`;
      ws.getCell(row, c).font = { ...dataFont(), bold: true, underline: true };
    }
    ws.getCell(row + 1, c).value = jabatan;
    ws.getCell(row + 1, c).font = { ...dataFont(), italic: true };
  }

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
