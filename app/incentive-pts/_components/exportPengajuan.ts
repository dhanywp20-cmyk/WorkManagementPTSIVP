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
  /**
   * Batasi ke proyek yang BAST-nya jatuh di tahun ini saja. `null`/`undefined`
   * = semua tahun (perilaku lama, tidak berubah). Menyaring proyek MASUKNYA
   * (bast_date), bukan tahun pembayaran - satu proyek tetap tercatat lunas
   * 3 tahun berturut, tapi Anda bisa export "proyek yang selesai tahun ini"
   * saja tanpa membuka file lintas-tahun yang makin besar tiap tahun platform
   * berjalan.
   */
  year?: number | null;
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
  const { allUsers, supportsMap, managerName, managerUserId, year: tahunFilter } = data;
  //  Saring di sini, SEBELUM daftarProyek dibangun - supaya Tabel 1/2/3 dan
  //  akumulasi per-tahun-pembayaran di bawah semuanya otomatis mengikuti,
  //  tanpa menyalin ulang logikanya.
  const projects = tahunFilter == null
    ? data.projects
    : data.projects.filter(p => p.bast_date && new Date(p.bast_date).getFullYear() === tahunFilter);
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
  //  `nilai` menyimpan tiap nominal SEBELUM dijumlah - dipakai membangun
  //  RUMUS di bawah (bukan mengetik ulang o.total sebagai angka mati). Tidak
  //  bisa dirujuk sebagai referensi sel Excel: Tabel 1 bisa menggabung lebih
  //  dari satu orang berperan sama jadi SATU sel teks (lihat teksNamaPeran),
  //  jadi nominal satu orang belum tentu punya selnya sendiri untuk dirujuk.
  const perOrang = new Map<string, { nama: string; peran: Set<string>; total: number; jumlah: number; nilai: number[] }>();
  for (const { nama, peran, jumlah } of akumulasi) {
    const e = perOrang.get(nama) ?? { nama, peran: new Set<string>(), total: 0, jumlah: 0, nilai: [] };
    e.peran.add(peran); e.total += jumlah; e.jumlah += 1; e.nilai.push(jumlah);
    perOrang.set(nama, e);
  }
  const namaBelumFinal = new Set<string>();
  for (const [nama, peranSet] of semuaNamaTim) {
    if (perOrang.has(nama)) continue;
    perOrang.set(nama, { nama, peran: new Set(peranSet), total: 0, jumlah: 0, nilai: [] });
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
  const judulProyek = tahunFilter != null ? `Project BAST ${tahunFilter}` : 'Semua Project';
  cTitle.value = `Summary Incentive PTS IVP — ${judulProyek}${sufiksTahun}`;
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
    //  >1 orang pada peran yang sama - namanya digabung jadi satu sel (tidak
    //  ada sel terpisah per orang untuk dirujuk), tapi Rp tetap RUMUS - bukan
    //  angka mati - dengan menjumlah nominal masing-masing secara eksplisit
    //  di dalam formula-nya sendiri, supaya tetap bisa diperiksa di Excel.
    if (!isEstimate) {
      const total = orang.reduce((n, o) => n + o.amount, 0);
      cRp.value = sumCell(orang.map(o => String(o.amount)).join('+'), total);
    }
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
    //  RUMUS - menjumlah nominal orang ini secara eksplisit (lihat alasan
    //  `nilai` tidak bisa jadi referensi sel di komentar deklarasi perOrang).
    const nilaiTotal = o.nilai.length ? sumCell(o.nilai.join('+'), o.total) : o.total;
    const cT = selGabung(ws, row, KOL_REKAP.total, nilaiTotal, {
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
  row += 1;

  /*
    Catatan proyeksi tahap ke-2/ke-3 - kenapa CATATAN, bukan penanda per
    KOLOM: kolom di tabel ini adalah TAHUN KALENDER ("dibayarkan tahun 2027"),
    sama untuk semua orang, sedangkan tahap ke berapa tahun itu bagi SESEORANG
    tergantung BAST proyeknya masing-masing - tahun 2027 bisa jadi Tahap 1
    untuk proyek BAST 2026, sekaligus Tahap 2 untuk proyek BAST 2025. Menandai
    "kolom ke-2/ke-3" akan salah untuk sebagian orang, jadi disebut apa
    adanya di sini, bukan dipetakan ke posisi kolom yang keliru.
  */
  selGabung(ws, row, [KOL_REKAP.nama[0], KOL_TERAKHIR], 'Catatan: nilai Tahap 2 & 3 tiap proyek (tahun ke-2/ke-3 sejak BAST-nya '
    + 'masing-masing, bukan kolom ke-2/ke-3 di tabel ini) masih PROYEKSI - dihitung dari skema & Support yang terdeteksi saat '
    + 'berkas ini dibuat. Support baru yang terdeteksi sepanjang tahun tersebut bisa mengubah nominalnya. Export ulang menjelang '
    + 'akhir tahun bersangkutan untuk memastikan Support terbaru sudah ikut terhitung sebelum Process Batch dijalankan.',
    { font: { italic: true, size: 8, name: 'Arial', color: { argb: 'B45309' } } });
  ws.getRow(row).height = 24;
  row += 2;

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
  const labelTahun = data.year != null ? String(data.year) : 'SemuaTahun';
  saveAs(blob, `Summary_Incentive_PTS_IVP_${labelTahun}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
