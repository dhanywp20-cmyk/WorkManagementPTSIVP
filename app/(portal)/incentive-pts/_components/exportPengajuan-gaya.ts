'use client';
/** exportPengajuan-gaya.ts - dipecah dari exportPengajuan.ts (scripts/pecah-modul.mjs); exportPengajuan.ts tetap mengekspor ulang semuanya. */
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
export function sumCell(formula: string, result: number): { formula: string; result: number } {
  return { formula, result };
}

/** Nama peran seperti yang dibaca Finance, bukan kunci teknisnya. */
const ROLE_JUDUL: Record<string, string> = {
  pic: 'PIC', support: 'Support', supervisor: 'Supervisor',
  manager: 'Manager', installer: 'PTS Daerah',
};

/*
  TEMA & KERANGKA KOLOM BERSAMA untuk KEDUA berkas ekspor.

  "Pengajuan Incentive" (per tahun tahapan) dan "Summary Incentive" (seluruh
  proyek) adalah dokumen yang sama bentuknya, beda cakupannya saja - jadi
  warna, lebar kolom, dan susunan kepala tabelnya ditulis SEKALI di sini.
  Sebelumnya keduanya punya salinan sendiri dan sudah terlanjur menyimpang
  jauh: yang satu memakai satu pasang kolom per ORANG (melebar tak terkendali
  begitu timnya bertambah), yang satu lagi per PERAN. Dua salinan aturan
  tampilan yang sama adalah cara paling mudah membuat dua berkas yang
  seharusnya kembar jadi tidak bisa dibandingkan.
*/
export const NAVY_HDR = '1F3864';

export const SUB_HDR = '2E5395';

export const TOTAL_FILL = 'D9E1F2';

export const INSTALLER_FILL = 'FFF2CC';

export const RUPIAH_FMT = '#,##0;(#,##0);"-"';

   // dash untuk nol - bukan sekadar kosong

export const putih = (): Partial<ExcelJS.Font> => ({ bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Arial' });

export const fillWarna = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });

/**
 * Kolom A sengaja dibiarkan sempit sebagai spasi tepi - isi mulai kolom B,
 * menyamai contoh yang dipakai Finance, bukan menempel ke tepi kertas.
 *
 * Hanya kolom DASAR (sama untuk semua export) yang tetap di sini. Kolom
 * per-orang di Tabel 1 dan kolom per-tahun di Tabel 3 jumlahnya BERUBAH
 * tergantung berapa orang/tahun yang tercatat - keduanya dihitung di dalam
 * bangunWorkbookSummary begitu daftar orang & tahunnya sudah diketahui,
 * bukan angka tetap di sini. Lihat KOL_ORANG_AWAL.
 */
export const KOL = { no: 2, project: 3, mode: 4, bast: 5, nominal: 6 };

/** Kolom pertama tempat grup per-orang (Posisi/%/Rp) mulai ditulis di Tabel 1. */
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

/**
 * Kepala tabel rekap per orang.
 *
 * Kolom Nama & Peran DIGABUNG melintasi beberapa kolom, dan itu bukan hiasan:
 * tabel ini berbagi kisi kolom dengan Tabel 1 di atasnya, yang kolom B-nya
 * selebar 5 karakter karena di sana isinya cuma nomor urut. Tanpa penggabungan,
 * nama seperti "Ade Rachmatullah" terlipat satu-dua huruf per baris - persis
 * keluhan "nama jadi tertumpuk, tidak proporsional" - dan tinggi barisnya ikut
 * membengkak. Melebarkan kolom B bukan jalan keluar: itu akan membuat kolom
 * "No" Tabel 1 jadi lebar tanpa alasan.
 */
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

/**
 * Lebarkan kolom TANPA PERNAH MENGECILKANNYA.
 *
 * Tabel 3 (Nilai Pengajuan per Tahun) menaruh kolom tahun-nya di kisi kolom
 * yang SAMA dengan kolom peran Tabel 1 di atasnya - keduanya berbagi satu
 * grid kolom worksheet, cuma dipakai di rentang baris yang berbeda. Menimpa
 * lebar kolom di sana dengan `.width = angka` langsung akan MENGECILKAN
 * kolom yang sudah diset lebih lebar oleh Tabel 1 (mis. kolom Nominal 15
 * ditimpa jadi 8) - persis penyebab nominal tampil "########" dan nama
 * peran tumpang tindih ke baris berikutnya. Fungsi ini hanya boleh melebarkan.
 */
export function perbesarKolom(ws: ExcelJS.Worksheet, kolom: number, minimal: number) {
  const c = ws.getColumn(kolom);
  c.width = Math.max(c.width ?? 0, minimal);
}

/** Berapa baris yang dibutuhkan sebuah teks kalau dibungkus pada lebar kolom (karakter). */
export function hitungBarisTerbungkus(teks: string, lebarKarakter: number): number {
  return teks.split('\n').reduce((n, baris) => n + Math.max(1, Math.ceil(baris.length / lebarKarakter)), 0);
}

/** Rentang kolom rekap per orang - dipakai kedua berkas supaya bentuknya sama. */
export const KOL_REKAP = {
  nama:   [KOL.no, KOL.project] as [number, number],        // B:C - cukup untuk nama panjang
  peran:  [KOL.mode, KOL.bast] as [number, number],         // D:E
  jumlah: [KOL.nominal, KOL.nominal] as [number, number],   // F
  //  G:I - dipinjam dari kisi kolom grup orang pertama Tabel 1 (KOL_ORANG_AWAL),
  //  lihat komentar tulisKepalaPerOrang soal berbagi kisi kolom antar tabel.
  total: [KOL_ORANG_AWAL, KOL_ORANG_AWAL + 2] as [number, number],
};

/** Tulis satu sel gabungan berisi teks, dengan garis tepi di seluruh rentangnya. */
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
