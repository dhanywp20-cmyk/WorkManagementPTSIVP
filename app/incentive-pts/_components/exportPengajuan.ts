'use client';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  IncentiveProjectRow, IncentiveSplit, IncentiveTranche,
  SplitResult, formatRupiah, formatPct,
  calculateIncentiveSplits, findUpline, resolveUserId, OrgUser, ambilSkema, TRANCHE_STATUS,
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
const NAVY_HDR = '1F3864';
const SUB_HDR = '2E5395';
const TOTAL_FILL = 'D9E1F2';
const INSTALLER_FILL = 'FFF2CC';
const RUPIAH_FMT = '#,##0;(#,##0);"-"';   // dash untuk nol - bukan sekadar kosong

const putih = (): Partial<ExcelJS.Font> => ({ bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Arial' });
const fillWarna = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });

/**
 * Kolom A sengaja dibiarkan sempit sebagai spasi tepi - isi mulai kolom B,
 * menyamai contoh yang dipakai Finance, bukan menempel ke tepi kertas.
 */
const KOL = {
  no: 2, project: 3, mode: 4, bast: 5, nominal: 6,
  picNama: 7, picPct: 8, picRp: 9,
  suppNama: 10, suppPct: 11, suppRp: 12,
  supvNama: 13, supvPct: 14, supvRp: 15,
  mgrNama: 16, mgrPct: 17, mgrRp: 18,
  instNama: 19, instLokasi: 20, instPct: 21, instRp: 22,
};
const KOL_TERAKHIR = KOL.instRp; // 22 = V

function aturLebarKolom(ws: ExcelJS.Worksheet) {
  ws.getColumn(1).width = 3;
  ws.getColumn(KOL.no).width = 5;
  ws.getColumn(KOL.project).width = 30;
  ws.getColumn(KOL.mode).width = 10;
  ws.getColumn(KOL.bast).width = 13;
  ws.getColumn(KOL.nominal).width = 15;
  for (const c of [KOL.picNama, KOL.suppNama, KOL.supvNama, KOL.mgrNama, KOL.instNama]) ws.getColumn(c).width = 17;
  for (const c of [KOL.picPct, KOL.suppPct, KOL.supvPct, KOL.mgrPct, KOL.instPct]) ws.getColumn(c).width = 7;
  for (const c of [KOL.picRp, KOL.suppRp, KOL.supvRp, KOL.mgrRp, KOL.instRp]) ws.getColumn(c).width = 14;
  ws.getColumn(KOL.instLokasi).width = 12;
}

/** Satu penerima porsi pada sebuah proyek, sudah siap dicetak. */
export interface PeranEkspor {
  user_id: string; user_name: string; role: string; percentage: number; amount: number;
}

/**
 * Dua baris kepala Tabel "List Project": baris atas nama peran (digabung),
 * baris bawah Nama/%/Rp. Installer punya satu kolom ekstra (Lokasi).
 */
function tulisKepalaListProject(
  ws: ExcelJS.Worksheet, kepalaA: number, kepalaB: number,
  label: { nominal: string; mode?: string; bast?: string },
) {
  const HDR_DASAR: [number, string][] = [
    [KOL.no, 'No'], [KOL.project, 'Project'],
    [KOL.mode, label.mode ?? 'Mode'], [KOL.bast, label.bast ?? 'BAST'],
    [KOL.nominal, label.nominal],
  ];
  for (const [kolom, teks] of HDR_DASAR) {
    const c = ws.getCell(kepalaA, kolom);
    c.value = teks; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder();
    ws.mergeCells(kepalaA, kolom, kepalaB, kolom);
  }
  const GRUP: [string, number, number][] = [
    ['PIC', KOL.picNama, KOL.picRp], ['Support', KOL.suppNama, KOL.suppRp],
    ['Supervisor', KOL.supvNama, KOL.supvRp], ['Manager', KOL.mgrNama, KOL.mgrRp],
  ];
  for (const [label, awal, akhir] of GRUP) {
    const c = ws.getCell(kepalaA, awal);
    c.value = label; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
    ws.mergeCells(kepalaA, awal, kepalaA, akhir);
    for (const [off, sub] of [[0, 'Nama'], [1, '%'], [2, 'Rp']] as [number, string][]) {
      const x = ws.getCell(kepalaB, awal + off);
      x.value = sub; x.font = putih(); x.fill = fillWarna(SUB_HDR);
      x.alignment = { horizontal: 'center', vertical: 'middle' }; x.border = thinBorder();
    }
  }
  const cInst = ws.getCell(kepalaA, KOL.instNama);
  cInst.value = 'Installer'; cInst.font = putih(); cInst.fill = fillWarna(NAVY_HDR);
  cInst.alignment = { horizontal: 'center', vertical: 'middle' }; cInst.border = thinBorder();
  ws.mergeCells(kepalaA, KOL.instNama, kepalaA, KOL.instRp);
  for (const [off, sub] of [[0, 'Nama'], [1, 'Lokasi'], [2, '%'], [3, 'Rp']] as [number, string][]) {
    const x = ws.getCell(kepalaB, KOL.instNama + off);
    x.value = sub; x.font = putih(); x.fill = fillWarna(SUB_HDR);
    x.alignment = { horizontal: 'center', vertical: 'middle' }; x.border = thinBorder();
  }
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
function tulisKepalaPerOrang(ws: ExcelJS.Worksheet, baris: number, judulKolom: [string, number, number][]) {
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
function perbesarKolom(ws: ExcelJS.Worksheet, kolom: number, minimal: number) {
  const c = ws.getColumn(kolom);
  c.width = Math.max(c.width ?? 0, minimal);
}

/** Berapa baris yang dibutuhkan sebuah teks kalau dibungkus pada lebar kolom (karakter). */
function hitungBarisTerbungkus(teks: string, lebarKarakter: number): number {
  return teks.split('\n').reduce((n, baris) => n + Math.max(1, Math.ceil(baris.length / lebarKarakter)), 0);
}

/** Rentang kolom rekap per orang - dipakai kedua berkas supaya bentuknya sama. */
const KOL_REKAP = {
  nama:   [KOL.no, KOL.project] as [number, number],        // B:C - cukup untuk nama panjang
  peran:  [KOL.mode, KOL.bast] as [number, number],         // D:E
  jumlah: [KOL.nominal, KOL.nominal] as [number, number],   // F
  total:  [KOL.picNama, KOL.picRp] as [number, number],     // G:I
};

/** Tulis satu sel gabungan berisi teks, dengan garis tepi di seluruh rentangnya. */
function selGabung(
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

/*
  REKAP PENGAJUAN INSENTIF SATU TAHUN.

  Bentuknya SENGAJA sama persis dengan Summary Incentive - kepala tabel,
  warna, dan susunan kolomnya datang dari helper yang sama (tulisKepalaListProject,
  tulisKepalaPerOrang, selGabung). Bedanya cuma cakupan: Summary memuat seluruh
  proyek dengan porsi penuh tiap orang, sedangkan berkas ini hanya memuat
  tahapan yang jatuh tempo pada SATU tahun anggaran, dengan rupiah sebesar
  tahapan tahun itu saja.

  Bentuk sebelumnya berbeda sama sekali: satu pasang kolom (%, Rp) untuk TIAP
  ORANG, berjajar ke kanan. Dua masalahnya nyata, bukan selera. Pertama,
  lebarnya tumbuh mengikuti jumlah anggota tim - tujuh orang sudah memakan
  kolom A sampai S, dan tim yang bertambah membuatnya tidak bisa dicetak.
  Kedua, dua berkas yang dibaca berdampingan oleh orang yang sama jadi tidak
  bisa dibandingkan baris per baris, padahal keduanya menjelaskan uang yang
  sama dari sudut berbeda.

  ANGKANYA TIDAK DIHITUNG ULANG bila tahapannya sudah diproses: yang dipakai
  adalah baris incentive_splits milik tahapan tahun itu - persis rupiah yang
  tercatat akan dibayarkan. Proyek yang tahapannya masih Pending belum punya
  baris tersimpan, jadi angkanya diproyeksikan dengan mesin yang sama seperti
  Process Batch dan ditandai "(proyeksi)" supaya tidak tertukar dengan yang
  sudah pasti.
*/
/**
 * Susun workbook-nya saja - tanpa membaca basis data, tanpa mengunduh.
 * Dipisah dengan alasan yang sama seperti bangunWorkbookSummary: supaya tata
 * letaknya bisa diperiksa otomatis di luar peramban.
 */
export async function bangunWorkbookPengajuan(data: ExportData, sk: SkemaInsentif) {
  const { year, projects, splits, tranches, managerName, directorName, splitsProyeksi } = data;

  const tahapUrut = [...sk.tranche].sort((a, b) => a.nomor - b.nomor);
  const totalPersenTahap = tahapUrut.reduce((n, t) => n + (t.persen || 0), 0) || 100;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Work Management PTS IVP';
  wb.created = new Date();
  const ws = wb.addWorksheet(`Pengajuan ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });
  aturLebarKolom(ws);

  /*
    Satu baris per proyek yang punya tahapan jatuh tempo tahun ini.

    Rupiah tiap orang diambil menurut urutan kepercayaan: baris pembagian yang
    SUDAH tersimpan untuk tahapan tahun ini lebih dulu; kalau belum ada, porsi
    penuh (dari splits proyek atau proyeksi) dipecah menurut persentase tahapan
    tahun ini. Installer diperlakukan terpisah - porsinya lunas di tahap
    pertama, jadi ia hanya muncul pada tahun tahap pertama itu.
  */
  type BarisProyek = {
    p: IncentiveProjectRow;
    pool: number;
    status: string;
    proyeksi: boolean;
    tahapNomor: number;
    persenTahap: number;
    pic: PeranEkspor[]; support: PeranEkspor[]; supervisor: PeranEkspor[];
    manager: PeranEkspor[]; installer: PeranEkspor[];
  };

  const daftar: BarisProyek[] = [];
  for (const p of projects) {
    const tahapTahunIni = tranches.find(t => t.project_id === p.id && t.payment_year === year);
    if (!tahapTahunIni) continue;

    const pool = p.incentive_value || 0;
    const persenTahap = tahapTahunIni.percentage || 0;
    const tahapPertama = tranches
      .filter(t => t.project_id === p.id)
      .sort((a, b) => a.tranche_number - b.tranche_number)[0];
    const tahunPertamaProyek = tahapPertama?.tranche_number === tahapTahunIni.tranche_number;

    //  1) Baris tersimpan milik tahapan tahun ini - paling tepercaya.
    //
    //  DIDEDUP per (orang, peran) - bukan sekadar dipetakan apa adanya.
    //  Kalau tahapan yang sama pernah diproses dua kali (mis. Process Batch
    //  tertekan dua kali sebelum ada penjagaan, atau baris lama peninggalan
    //  sebelum unique index dipasang), incentive_splits menyimpan DUA baris
    //  untuk orang & peran yang identik. Tanpa dedup ini, nama itu tercetak
    //  dua kali dalam satu sel ("Taufik wahyudi (55.0%)" berulang) DAN
    //  rupiahnya ikut DIJUMLAHKAN - melipatgandakan nominal yang tercetak
    //  padahal orangnya cuma satu. Yang diambil baris PERTAMA saja, bukan
    //  dijumlah - keduanya toh angka yang sama persis untuk orang yang sama.
    const tersimpanMentah = splits.filter(s => s.tranche_id === tahapTahunIni.id);
    const tersimpan = (() => {
      const unik = new Map<string, IncentiveSplit>();
      for (const s of tersimpanMentah) {
        const k = `${s.user_id || s.user_name}::${s.role}`;
        if (!unik.has(k)) unik.set(k, s);
      }
      return [...unik.values()];
    })();
    let orang: PeranEkspor[];
    let proyeksi = false;

    if (tersimpan.length > 0) {
      orang = tersimpan.map(s => ({
        user_id: s.user_id, user_name: s.user_name, role: s.role,
        percentage: s.percentage, amount: s.amount,
      }));
    } else {
      /*
        2) Belum diproses - dipecah dari porsi PENUH. Porsi penuh diambil dari
        baris pembagian proyek yang mana pun (percentage-nya terhadap pool,
        bukan terhadap tahap, jadi baris tahap mana pun memberi angka yang
        sama), atau dari proyeksi bila proyek ini belum punya baris sama sekali.
      */
      proyeksi = true;
      const penuh = splitsProyeksi?.get(p.id)
        ?? dedupPorsiPenuh(splits.filter(s => s.project_id === p.id));
      orang = penuh.map(s => {
        const porsiPenuh = (pool * (s.percentage || 0)) / 100;
        const installerLunasDiMuka = s.role === 'installer' && sk.installerBayarDiMuka;
        const amount = installerLunasDiMuka
          ? (tahunPertamaProyek ? porsiPenuh : 0)
          : (porsiPenuh * persenTahap) / totalPersenTahap;
        return {
          user_id: s.user_id, user_name: s.user_name, role: s.role,
          percentage: s.percentage, amount: Math.round(amount),
        };
      }).filter(s => s.amount > 0);
    }

    daftar.push({
      p, pool, status: tahapTahunIni.status, proyeksi,
      tahapNomor: tahapTahunIni.tranche_number, persenTahap,
      pic: orang.filter(s => s.role === 'pic'),
      support: orang.filter(s => s.role === 'support'),
      supervisor: orang.filter(s => s.role === 'supervisor'),
      manager: orang.filter(s => s.role === 'manager'),
      installer: orang.filter(s => s.role === 'installer'),
    });
  }

  let row = 2;

  // ── Judul ──────────────────────────────────────────────────────────────
  const cTitle = ws.getCell(row, KOL.no);
  cTitle.value = `Pengajuan Incentive Project-Project IVP Tahun ${year}`;
  cTitle.font = { bold: true, size: 14, name: 'Arial' };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  ws.getRow(row).height = 22;
  row += 1;

  const cSub = ws.getCell(row, KOL.no);
  cSub.value = `Saya yang bertanda tangan di bawah ini mengajukan pengeluaran Incentive Project-project IVP Tahun ${year}, `
    + 'dengan dasar perhitungan sebagai berikut:';
  cSub.font = { italic: true, size: 10, name: 'Arial', color: { argb: '555555' } };
  cSub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  //  Tanpa baris "Dihitung dengan skema ..." - kunci skema (pic60/support17/
  //  dst) adalah rincian internal, bukan sesuatu yang perlu tercetak di
  //  lembar yang ditandatangani ke Finance. Tanggal cetak juga sudah jelas
  //  dari tanggal tanda tangan di kaki berkas.
  row += 1;

  // ── TABEL 1 — Project yang dicairkan tahun ini, kolom berulang per orang ──
  /*
    Baris tetap = PROJECT, nama project tetap di kolom kiri seperti daftar
    biasa - percobaan sebelumnya membalik ini ke baris=orang dan itu justru
    TERBALIK dari yang diminta.

    Yang berulang adalah KOLOM: satu grup "Sebagai | % | Rp" per anggota Team
    PTS (urutan sama seperti Tabel 2 di bawah - Manager dulu, lalu Supervisor,
    PIC, Support, terakhir abjad), supaya menjumlah rupiah SATU orang lintas
    project tinggal membaca satu kolom ke bawah (dan baris TOTAL FINANCE di
    ujung sudah menjumlahkannya) - bukan mengumpulkan dari sel yang tersebar
    di kolom peran yang berbeda-beda seperti bentuk sebelum-sebelumnya, yang
    menumpuk semua nama sebuah peran jadi satu sel dan sempat tercetak dobel.

    Installer TIDAK ikut berulang seperti kolom Team PTS di atas - namanya
    beda-beda tiap project dan porsinya dibayar dengan aturan yang beda sama
    sekali (lunas sekali, bukan berulang per tahapan). Ia tetap satu set
    kolom TETAP (Nama / Lokasi / % / Rp) di ujung kanan, satu instance saja -
    isinya tinggal berbeda tiap baris/project.
  */

  //  Orang Team PTS yang jadi KOLOM - siapa pun berperan pic/support/
  //  supervisor/manager di project MANA PUN tahun ini. Peran "terbaik" yang
  //  dipakai untuk urutan (bukan tampilan - tampilan per sel pakai peran
  //  orang itu DI PROJECT tersebut, yang bisa beda-beda per project).
  const roleLabelT1 = (r: string) => ROLE_JUDUL[r] ?? r;
  const urutPeranT1: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3 };
  const peranTerbaikOrang = new Map<string, string>();
  daftar.forEach(b => {
    for (const o of [...b.pic, ...b.support, ...b.supervisor, ...b.manager]) {
      const nm = o.user_name || '—';
      const sblm = peranTerbaikOrang.get(nm);
      if (!sblm || (urutPeranT1[o.role] ?? 9) < (urutPeranT1[sblm] ?? 9)) peranTerbaikOrang.set(nm, o.role);
    }
  });
  const namaOrangUrut = [...peranTerbaikOrang.entries()]
    .sort((a, b) => (urutPeranT1[a[1]] ?? 9) - (urutPeranT1[b[1]] ?? 9) || a[0].localeCompare(b[0], 'id'))
    .map(([nama]) => nama);

  //  Posisi kolom dihitung dulu, sebelum judul ditulis, supaya lebar merge
  //  judul (dan baris "Catatan proyeksi" di bawah nanti) sudah tahu ujung
  //  kanannya - persis pola yang sudah dipakai Tabel 3 di Summary Export.
  let kh1 = KOL.nominal + 1;
  const kolomOrang: { nama: string; awal: number }[] = [];
  namaOrangUrut.forEach(nama => { kolomOrang.push({ nama, awal: kh1 }); kh1 += 3; });
  const kolInstNama = kh1, kolInstLokasi = kh1 + 1, kolInstPct = kh1 + 2, kolInstRp = kh1 + 3;
  const kolTerakhir1 = kolInstRp;

  const cJudul1 = ws.getCell(row, KOL.no);
  cJudul1.value = `1. Project yang Dicairkan Tahun ${year}`;
  cJudul1.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, kolTerakhir1);
  row += 1;

  const k1A = row, k1B = row + 1;
  const HDR_DASAR1: [number, string][] = [
    [KOL.no, 'No'], [KOL.project, 'Project'], [KOL.mode, 'Tahap'],
    [KOL.bast, 'Status'], [KOL.nominal, `Pencairan ${year} (Rp)`],
  ];
  for (const [kolom, teks] of HDR_DASAR1) {
    const c = ws.getCell(k1A, kolom);
    c.value = teks; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = thinBorder();
    ws.getCell(k1B, kolom).fill = fillWarna(NAVY_HDR); ws.getCell(k1B, kolom).border = thinBorder();
    ws.mergeCells(k1A, kolom, k1B, kolom);
  }
  kolomOrang.forEach(({ nama, awal }) => {
    const c = ws.getCell(k1A, awal);
    c.value = nama; c.font = putih(); c.fill = fillWarna(NAVY_HDR);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = thinBorder();
    ws.mergeCells(k1A, awal, k1A, awal + 2);
    for (const [off, teks] of [[0, 'Sebagai'], [1, '%'], [2, 'Rp']] as [number, string][]) {
      const s = ws.getCell(k1B, awal + off);
      s.value = teks; s.font = putih(); s.fill = fillWarna(SUB_HDR);
      s.alignment = { horizontal: 'center', vertical: 'middle' }; s.border = thinBorder();
    }
    perbesarKolom(ws, awal, 12); perbesarKolom(ws, awal + 1, 7); perbesarKolom(ws, awal + 2, 13);
  });
  const cInst1 = ws.getCell(k1A, kolInstNama);
  cInst1.value = 'Installer'; cInst1.font = putih(); cInst1.fill = fillWarna(NAVY_HDR);
  cInst1.alignment = { horizontal: 'center', vertical: 'middle' }; cInst1.border = thinBorder();
  ws.mergeCells(k1A, kolInstNama, k1A, kolInstRp);
  for (const [off, teks] of [[0, 'Nama'], [1, 'Lokasi'], [2, '%'], [3, 'Rp']] as [number, string][]) {
    const s = ws.getCell(k1B, kolInstNama + off);
    s.value = teks; s.font = putih(); s.fill = fillWarna(SUB_HDR);
    s.alignment = { horizontal: 'center', vertical: 'middle' }; s.border = thinBorder();
  }
  perbesarKolom(ws, kolInstNama, 17); perbesarKolom(ws, kolInstLokasi, 12);
  perbesarKolom(ws, kolInstPct, 7); perbesarKolom(ws, kolInstRp, 13);
  ws.getRow(k1A).height = 22;
  row = k1B + 1;
  const t1Awal = row;

  daftar.forEach((b, idx) => {
    const r = row + idx;
    const cNo = ws.getCell(r, KOL.no); cNo.value = idx + 1; cNo.border = thinBorder();
    cNo.alignment = { horizontal: 'center', vertical: 'middle' }; cNo.font = dataFont();

    const cProj = ws.getCell(r, KOL.project); cProj.value = b.p.project_name; cProj.border = thinBorder();
    cProj.alignment = { vertical: 'middle', wrapText: true }; cProj.font = dataFont();

    //  Kolom Tahap dipakai menampilkan TAHAP KE BERAPA - pada berkas per
    //  tahun, itulah keterangan yang menentukan besarnya pencairan.
    const cTahap = ws.getCell(r, KOL.mode);
    cTahap.value = `T${b.tahapNomor} · ${b.persenTahap}%`;
    cTahap.border = thinBorder(); cTahap.alignment = { horizontal: 'center', vertical: 'middle' };
    cTahap.font = dataFont();

    const cStatus = ws.getCell(r, KOL.bast);
    cStatus.value = b.proyeksi ? `${TRANCHE_STATUS[b.status]?.label ?? b.status} (proyeksi)` : (TRANCHE_STATUS[b.status]?.label ?? b.status);
    cStatus.border = thinBorder(); cStatus.alignment = { vertical: 'middle', wrapText: true };
    cStatus.font = b.proyeksi
      ? { ...dataFont(9), italic: true, color: { argb: 'B45309' } }
      : dataFont(9);

    const totalBaris = [...b.pic, ...b.support, ...b.supervisor, ...b.manager, ...b.installer]
      .reduce((n, o) => n + o.amount, 0);
    const cNom = ws.getCell(r, KOL.nominal);
    cNom.value = totalBaris;
    cNom.numFmt = RUPIAH_FMT; cNom.border = thinBorder();
    cNom.alignment = { horizontal: 'right', vertical: 'middle' };
    cNom.font = { ...dataFont(), bold: true };

    //  Digabung per NAMA - kalau seseorang kebetulan punya dua peran pada
    //  project yang sama (mis. skema Manager-as-PIC), rupiahnya dijumlah dan
    //  peran-perannya ditulis sekaligus, bukan salah satunya hilang tertimpa.
    const agregatOrang = new Map<string, { peran: string[]; pct: number; rp: number }>();
    for (const o of [...b.pic, ...b.support, ...b.supervisor, ...b.manager]) {
      const nm = o.user_name || '—';
      const e = agregatOrang.get(nm) ?? { peran: [], pct: 0, rp: 0 };
      e.peran.push(roleLabelT1(o.role)); e.pct += o.percentage; e.rp += o.amount;
      agregatOrang.set(nm, e);
    }
    kolomOrang.forEach(({ nama, awal }) => {
      const isi = agregatOrang.get(nama);
      const cSb = ws.getCell(r, awal), cPc = ws.getCell(r, awal + 1), cRp = ws.getCell(r, awal + 2);
      [cSb, cPc, cRp].forEach(c => { c.border = thinBorder(); c.font = dataFont(9); });
      cPc.numFmt = '0.0%'; cPc.alignment = { horizontal: 'center', vertical: 'middle' };
      cRp.numFmt = RUPIAH_FMT; cRp.alignment = { horizontal: 'right', vertical: 'middle' };
      cSb.alignment = { horizontal: 'center', vertical: 'middle' };
      if (isi) { cSb.value = isi.peran.join(', '); cPc.value = isi.pct / 100; cRp.value = isi.rp; }
      else { cSb.value = '—'; }
    });

    const cIN = ws.getCell(r, kolInstNama), cIL = ws.getCell(r, kolInstLokasi);
    const cIP = ws.getCell(r, kolInstPct), cIR = ws.getCell(r, kolInstRp);
    [cIN, cIL, cIP, cIR].forEach(c => { c.border = thinBorder(); c.font = dataFont(); });
    cIP.numFmt = '0.0%'; cIP.alignment = { horizontal: 'center', vertical: 'middle' };
    cIR.numFmt = RUPIAH_FMT; cIR.alignment = { horizontal: 'right', vertical: 'middle' };
    cIN.alignment = { vertical: 'middle', wrapText: true };
    if (b.installer.length === 0) { cIN.value = '—'; }
    else {
      cIN.value = b.installer[0].user_name;
      cIL.value = b.p.installer_daerah || '—';
      cIP.value = b.installer[0].percentage / 100;
      cIR.value = b.installer.reduce((n, o) => n + o.amount, 0);
    }
  });
  const t1Akhir = t1Awal + daftar.length - 1;
  row = daftar.length ? t1Akhir + 1 : t1Awal;

  if (daftar.length === 0) {
    selGabung(ws, row, [KOL.no, kolTerakhir1], `Tidak ada tahapan yang jatuh tempo di tahun ${year}.`,
      { font: { ...dataFont(), italic: true, color: { argb: '999999' } }, rata: 'center' });
    row += 1;
  }

  // TOTAL FINANCE — Nominal dijumlah per baris seperti biasa, DAN setiap
  // kolom Rp per orang + Installer ikut dijumlah ke bawah - itulah intinya
  // permintaan "lebih mudah summary penjumlahannya".
  selGabung(ws, row, [KOL.no, KOL.bast], 'TOTAL FINANCE',
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  const totalSemua = daftar.reduce((n, b) =>
    n + [...b.pic, ...b.support, ...b.supervisor, ...b.manager, ...b.installer].reduce((m, o) => m + o.amount, 0), 0);
  const cTotNom = ws.getCell(row, KOL.nominal);
  cTotNom.value = daftar.length
    ? sumCell(`SUM(${getColLetter(KOL.nominal)}${t1Awal}:${getColLetter(KOL.nominal)}${t1Akhir})`, totalSemua)
    : 0;
  cTotNom.numFmt = RUPIAH_FMT; cTotNom.font = { ...dataFont(), bold: true }; cTotNom.fill = fillWarna(TOTAL_FILL);
  cTotNom.border = thinBorder(); cTotNom.alignment = { horizontal: 'right', vertical: 'middle' };

  kolomOrang.forEach(({ nama, awal }) => {
    for (let c = awal; c <= awal + 1; c++) { const x = ws.getCell(row, c); x.fill = fillWarna(TOTAL_FILL); x.border = thinBorder(); }
    const totalOrang = daftar.reduce((n, b) => {
      const semua = [...b.pic, ...b.support, ...b.supervisor, ...b.manager];
      return n + semua.filter(o => (o.user_name || '—') === nama).reduce((m, o) => m + o.amount, 0);
    }, 0);
    const cRpTot = ws.getCell(row, awal + 2);
    cRpTot.value = daftar.length
      ? sumCell(`SUM(${getColLetter(awal + 2)}${t1Awal}:${getColLetter(awal + 2)}${t1Akhir})`, totalOrang)
      : 0;
    cRpTot.numFmt = RUPIAH_FMT; cRpTot.font = { ...dataFont(), bold: true }; cRpTot.fill = fillWarna(TOTAL_FILL);
    cRpTot.border = thinBorder(); cRpTot.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  for (let c = kolInstNama; c <= kolInstPct; c++) { const x = ws.getCell(row, c); x.fill = fillWarna(TOTAL_FILL); x.border = thinBorder(); }
  const totalInstaller = daftar.reduce((n, b) => n + b.installer.reduce((m, o) => m + o.amount, 0), 0);
  const cInstTot = ws.getCell(row, kolInstRp);
  cInstTot.value = daftar.length
    ? sumCell(`SUM(${getColLetter(kolInstRp)}${t1Awal}:${getColLetter(kolInstRp)}${t1Akhir})`, totalInstaller)
    : 0;
  cInstTot.numFmt = RUPIAH_FMT; cInstTot.font = { ...dataFont(), bold: true }; cInstTot.fill = fillWarna(TOTAL_FILL);
  cInstTot.border = thinBorder(); cInstTot.alignment = { horizontal: 'right', vertical: 'middle' };
  row += 1;

  const adaProyeksi = daftar.filter(b => b.proyeksi).length;
  if (adaProyeksi > 0) {
    selGabung(ws, row, [KOL.no, Math.max(kolTerakhir1, KOL_TERAKHIR)],
      `Catatan: ${adaProyeksi} project bertanda "(proyeksi)" belum melewati Process Batch — angkanya dihitung dari skema `
      + 'yang berlaku saat berkas ini dibuat dan masih bisa berubah. Jalankan Process Batch untuk membekukannya.',
      { font: { italic: true, size: 8, name: 'Arial', color: { argb: 'B45309' } } });
    ws.getRow(row).height = 20;
    row += 1;
  }
  row += 1;
  // ── TABEL 2 — Rekap per orang untuk tahun ini ─────────────────────────
  const cJudul2 = ws.getCell(row, KOL.no);
  cJudul2.value = `2. Nilai Pengajuan per Orang — Tahun ${year}`;
  cJudul2.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const urutPeran: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3, installer: 4 };
  const roleLabel = (r: string) => ROLE_JUDUL[r] ?? r;
  const perOrang = new Map<string, { nama: string; peran: Set<string>; jumlah: number; total: number }>();
  for (const b of daftar) {
    for (const o of [...b.pic, ...b.support, ...b.supervisor, ...b.manager, ...b.installer]) {
      const nm = o.user_name || '—';
      const e = perOrang.get(nm) ?? { nama: nm, peran: new Set<string>(), jumlah: 0, total: 0 };
      e.peran.add(o.role); e.jumlah += 1; e.total += o.amount;
      perOrang.set(nm, e);
    }
  }
  const orangUrut = [...perOrang.values()].sort((a, b) => {
    const pa = Math.min(...[...a.peran].map(r => urutPeran[r] ?? 9));
    const pb = Math.min(...[...b.peran].map(r => urutPeran[r] ?? 9));
    return pa - pb || a.nama.localeCompare(b.nama, 'id');
  });

  tulisKepalaPerOrang(ws, row, [
    ['Nama', ...KOL_REKAP.nama], ['Peran', ...KOL_REKAP.peran],
    ['Jumlah Project', ...KOL_REKAP.jumlah], [`Diterima ${year} (Rp)`, ...KOL_REKAP.total],
  ] as [string, number, number][]);
  row += 1;
  const t2Awal = row;
  orangUrut.forEach(o => {
    const hanyaInstaller = o.peran.size === 1 && o.peran.has('installer');
    const isi = hanyaInstaller ? INSTALLER_FILL : undefined;
    selGabung(ws, row, KOL_REKAP.nama, o.nama, { isi });
    selGabung(ws, row, KOL_REKAP.peran,
      [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9)).map(roleLabel).join(', '), { isi });
    selGabung(ws, row, KOL_REKAP.jumlah, o.jumlah, { rata: 'center', isi });
    const cT = selGabung(ws, row, KOL_REKAP.total, o.total,
      { rata: 'right', font: { ...dataFont(), bold: true }, isi });
    cT.numFmt = RUPIAH_FMT;
    row += 1;
  });
  const t2Akhir = row - 1;
  if (orangUrut.length === 0) {
    selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.total[1]], '(Belum ada penerima di tahun ini)',
      { font: { ...dataFont(), italic: true, color: { argb: '999999' } } });
    row += 1;
  }
  selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.jumlah[1]], 'GRAND TOTAL',
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  const cGT = selGabung(ws, row, KOL_REKAP.total,
    orangUrut.length
      ? sumCell(`SUM(${getColLetter(KOL_REKAP.total[0])}${t2Awal}:${getColLetter(KOL_REKAP.total[0])}${t2Akhir})`,
        orangUrut.reduce((n, o) => n + o.total, 0))
      : 0,
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  cGT.numFmt = RUPIAH_FMT;
  row += 1;

  selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.total[1]],
    'Installer ditandai kuning — porsinya dibayar 100% sekali di tahun pertama proyeknya, tidak dipecah per tahapan.',
    { font: { italic: true, size: 8, name: 'Arial', color: { argb: '808080' } } });
  row += 3;

  // ── Tanggal & tanda tangan ────────────────────────────────────────────
  ws.getCell(row, KOL.no).value = `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  ws.getCell(row, KOL.no).font = dataFont();
  row += 2;

  const ttdKolom = [KOL.no, KOL.suppNama, KOL.mgrNama];
  const ttdLabel = ['Di buat oleh,', 'Diperiksa Oleh,', 'Menyetujui,'];
  ttdKolom.forEach((c, i) => { ws.getCell(row, c).value = ttdLabel[i]; ws.getCell(row, c).font = dataFont(); });
  row += 4;
  const ttdNama = [managerName, '', directorName];
  const ttdJabatan = ['Manager PTS IVP', 'Finance', 'Director'];
  ttdKolom.forEach((c, i) => {
    ws.getCell(row, c).value = ttdNama[i] ? `( ${ttdNama[i]} )` : '(                    )';
    ws.getCell(row, c).font = ttdNama[i] ? { ...dataFont(), bold: true, underline: true } : dataFont();
    ws.getCell(row + 1, c).value = ttdJabatan[i];
    ws.getCell(row + 1, c).font = { ...dataFont(), italic: true };
  });

  ws.views = [{ state: 'frozen', ySplit: k1B, xSplit: 0 }];

  return wb;
}

/** Baca skema, susun workbook-nya, lalu unduh. Dipanggil tombol Export tahun berjalan. */
export async function exportPengajuanIncentive(data: ExportData) {
  const sk = await ambilSkema();
  const wb = await bangunWorkbookPengajuan(data, sk);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Pengajuan_Incentive_PTS_IVP_${data.year}.xlsx`);
}

/**
 * Porsi PENUH tiap orang, satu baris per (orang, peran).
 *
 * Satu proyek dicairkan beberapa kali, jadi bila tahap 1 dan 2 sama-sama
 * sudah diproses, orang yang sama muncul dua kali dengan percentage yang
 * identik - menjumlahkannya akan melipatgandakan porsinya.
 */
function dedupPorsiPenuh(baris: IncentiveSplit[]): PeranEkspor[] {
  const unik = new Map<string, PeranEkspor>();
  for (const s of baris) {
    const k = `${s.user_id || s.user_name}::${s.role}`;
    if (unik.has(k)) continue;
    unik.set(k, {
      user_id: s.user_id, user_name: s.user_name, role: s.role,
      percentage: s.percentage, amount: 0,
    });
  }
  return [...unik.values()];
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

  aturLebarKolom(ws);

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

  /** Teks yang akan tampil di kolom Nama sebuah peran - dipakai menulis SEL sekaligus menghitung tinggi baris. */
  function teksNamaPeran(orang: Peran[]): string {
    if (orang.length === 0) return '—';
    if (orang.length === 1) return orang[0].user_name;
    return orang.map(o => `${o.user_name} (${(o.percentage).toFixed(1)}%)`).join('\n');
  }

  /** Sel Nama/%/Rp satu peran. >1 orang -> nama digabung, Rp dijumlah statis (bukan formula). */
  function tulisPeran(r: number, kolNama: number, orang: Peran[], baris: number, pool: number, isEstimate: boolean) {
    const cNama = ws.getCell(r, kolNama);
    const cPct = ws.getCell(r, kolNama + 1);
    const cRp = ws.getCell(r, kolNama + 2);
    [cNama, cPct, cRp].forEach(c => { c.border = thinBorder(); c.font = dataFont(); });
    cPct.numFmt = '0.0%'; cPct.alignment = { horizontal: 'center', vertical: 'middle' };
    cRp.numFmt = RUPIAH_FMT; cRp.alignment = { horizontal: 'right', vertical: 'middle' };
    cNama.alignment = { vertical: 'middle', wrapText: true };
    cNama.value = teksNamaPeran(orang);

    if (orang.length === 0) return;
    if (orang.length === 1) {
      const o = orang[0];
      cPct.value = o.percentage / 100;
      const hurufPct = getColLetter(kolNama + 1), hurufPool = getColLetter(KOL.nominal);
      cRp.value = isEstimate ? null
        : sumCell(`IF($${hurufPct}${baris}="","",$${hurufPool}${baris}*$${hurufPct}${baris})`, o.amount);
      if (isEstimate) { cNama.font = { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } }; cPct.value = null; }
      return;
    }
    // >1 orang pada peran yang sama - digabung, Rp dijumlah (statis, bukan formula).
    cRp.value = isEstimate ? null : orang.reduce((n, o) => n + o.amount, 0);
    if (isEstimate) cNama.font = { ...dataFont(), italic: true, color: { argb: 'AAAAAA' } };
  }

  daftarProyek.forEach((pr, idx) => {
    const r = dataAwal + idx;
    /*
      Tinggi baris DIHITUNG dari isinya, bukan angka tetap.

      Sebelumnya setiap baris dipatok 18px berapa pun isinya. Begitu Excel
      diberi tinggi baris eksplisit, ia BERHENTI menyesuaikan tinggi otomatis
      untuk baris itu - jadi sel yang teksnya melipat ke baris kedua (nama
      "Ferdinan Agustinus" di kolom selebar 17 karakter, atau Support berisi
      lebih dari satu orang) terpotong/tumpang tindih secara visual, persis
      keluhan "nama jadi tertumpuk". lebarKarakter di bawah mengikuti lebar
      kolom yang sesungguhnya (KOL) - kalau lebarnya berubah di sana, ukuran
      di sini ikut menyesuaikan karena keduanya bukan dua angka yang ditulis
      terpisah.
    */
    const kandidat: [string, number][] = [
      [pr.p.project_name, 30],
      [teksNamaPeran(pr.pic), 17], [teksNamaPeran(pr.support), 17],
      [teksNamaPeran(pr.supervisor), 17], [teksNamaPeran(pr.manager), 17],
      [pr.installer[0]?.user_name ?? '—', 17],
    ];
    const barisTerbanyak = Math.max(1, ...kandidat.map(([teks, lebar]) => hitungBarisTerbungkus(teks, lebar)));
    ws.getRow(r).height = Math.max(22, barisTerbanyak * 14 + 8);

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
  tulisKepalaPerOrang(ws, row, [
    ['Nama', ...KOL_REKAP.nama], ['Role', ...KOL_REKAP.peran],
    ['Jumlah Project', ...KOL_REKAP.jumlah], ['Total Nominal (Rp)', ...KOL_REKAP.total],
  ] as [string, number, number][]);
  row += 1;
  const t2Awal = row;
  orangUrut.forEach(o => {
    const belumFinal = namaBelumFinal.has(o.nama);
    const fontNama = belumFinal ? { ...dataFont(), italic: true, color: { argb: '999999' } } : dataFont();
    selGabung(ws, row, KOL_REKAP.nama, o.nama, { font: fontNama });
    selGabung(ws, row, KOL_REKAP.peran,
      [...o.peran].sort((a, b) => (urutPeran[a] ?? 9) - (urutPeran[b] ?? 9)).map(roleLabel).join(', '));
    selGabung(ws, row, KOL_REKAP.jumlah, o.jumlah, {
      rata: 'center',
      font: belumFinal ? { ...dataFont(), color: { argb: '999999' } } : dataFont(),
    });
    const cT = selGabung(ws, row, KOL_REKAP.total, o.total, {
      rata: 'right',
      font: belumFinal ? { ...dataFont(), bold: true, color: { argb: '999999' } } : { ...dataFont(), bold: true },
    });
    cT.numFmt = RUPIAH_FMT;
    row += 1;
  });
  const t2Akhir = row - 1;
  if (orangUrut.length === 0) {
    selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.total[1]], '(Belum ada project)',
      { font: { ...dataFont(), italic: true, color: { argb: '999999' } } });
    row += 1;
  }
  selGabung(ws, row, [KOL_REKAP.nama[0], KOL_REKAP.jumlah[1]], 'GRAND TOTAL',
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  const cGT2v = selGabung(ws, row, KOL_REKAP.total,
    orangUrut.length
      ? sumCell(`SUM(${getColLetter(KOL_REKAP.total[0])}${t2Awal}:${getColLetter(KOL_REKAP.total[0])}${t2Akhir})`,
        orangUrut.reduce((n, o) => n + o.total, 0))
      : 0,
    { font: { ...dataFont(), bold: true }, isi: TOTAL_FILL, rata: 'right' });
  cGT2v.numFmt = RUPIAH_FMT;
  row += 2;

  // ── TABEL 3 — Nilai Pengajuan Incentive per Tahun ────────────────────
  //  Tanpa paragraf penjelasan tahapan di sini - aturannya sudah ada di
  //  proposal, dan kepala tabelnya sendiri ("dibayarkan tahun N") sudah
  //  cukup menjawab pertanyaan "uang ini keluar kapan". Minim penjelasan,
  //  cukup yang ada di tabel.
  const cJudul3 = ws.getCell(row, KOL.no);
  cJudul3.value = '3. Nilai Pengajuan Incentive per Tahun';
  cJudul3.font = { bold: true, size: 12, name: 'Arial' };
  ws.mergeCells(row, KOL.no, row, KOL_TERAKHIR);
  row += 1;

  const k3A = row, k3B = row + 1;
  const cNamaH = ws.getCell(k3A, KOL_REKAP.nama[0]); cNamaH.value = 'Nama'; cNamaH.font = putih(); cNamaH.fill = fillWarna(NAVY_HDR);
  cNamaH.alignment = { horizontal: 'center', vertical: 'middle' }; cNamaH.border = thinBorder();
  //  Nama & Peran memakai rentang yang SAMA dengan Tabel 2 (B:C dan D:E) -
  //  lihat alasannya di tulisKepalaPerOrang: kolom B sendirian terlalu sempit
  //  untuk nama orang, dan melebarkannya akan merusak kolom "No" di Tabel 1.
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

  let kh = KOL_REKAP.peran[1] + 1;
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
  const kolTotal3 = kh;
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

  // Baris Installer - kuning, satu tahun terisi (100%), sisanya kosong.
  installerList.forEach(inst => {
    const r = row;
    //  Tanpa keterangan "100% di tahun pertama" - baris kuning + kolom
    //  Peran="Installer" sudah cukup menunjukkan bedanya dari Tim PTS, dan
    //  aturan pembayarannya sendiri sudah ada di proposal. Kepala tabel
    //  yang minim penjelasan lebih mudah dibaca daripada satu yang
    //  mengulang apa yang sudah tertulis di tempat lain.
    selGabung(ws, r, KOL_REKAP.nama, `${inst.nama}${inst.lokasi ? ' · ' + inst.lokasi : '' }`,
      { isi: INSTALLER_FILL });
    selGabung(ws, r, KOL_REKAP.peran, 'Installer', { isi: INSTALLER_FILL });

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
  const t3Akhir = row - 1;

  if (orangUrut.length === 0 && installerList.length === 0) {
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
