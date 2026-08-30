/*
  UJI: bentuk berkas Export Summary yang SUNGGUHAN.

  Bukan tiruan logika seperti uji lain di folder ini - ini memanggil
  bangunWorkbookSummary() yang dipakai tombol "Export Summary" itu sendiri,
  menulis hasilnya ke .xlsx, lalu membacanya kembali. Jadi kalau tata letaknya
  meleset dari contoh yang diminta, uji ini yang gagal - bukan pengguna yang
  harus mengunduh manual lalu melapor lagi.

  Data contohnya sengaja meniru berkas contoh: 5 proyek, dua di antaranya
  ber-Installer, satu tanpa nominal ("belum input").

    npx tsx uji/bentuk-summary-nyata.ts [--simpan <path>]

  --simpan menuliskan berkasnya ke path itu untuk diperiksa mata sendiri.
*/
import ExcelJS from 'exceljs';
import { bangunWorkbookSummary, bangunWorkbookPengajuan } from '../app/incentive-pts/_components/exportPengajuan';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Supabase & file-saver tidak pernah tersentuh: bangunWorkbookSummary menerima
// skema sebagai argumen dan mengembalikan workbook, tidak mengunduh apa pun.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://x.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'dummy';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ||= 'https://y.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY ||= 'dummy';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

const SKEMA = {
  versi: 3,
  porsi: [
    { peran: 'pic', label: 'PIC Proyek', persen: 65, bagiRata: true },
    { peran: 'support', label: 'Tim Support', persen: 15, bagiRata: true },
    { peran: 'supervisor', label: 'Supervisor', persen: 10, bagiRata: true },
    { peran: 'manager', label: 'Manager', persen: 10, bagiRata: false },
  ],
  tanpaSupport: { pic: 55, supervisor: 30, manager: 15 },
  jendelaSupportBulan: 12,
  hangusSupervisorKe: 'manager',
  managerSebagaiPic: { adaSupport: { pic: 100 }, tanpaSupport: { pic: 100 } },
  installerAktif: true, installerRemotePersen: 15,
  installerHanyaRemote: true, installerBayarDiMuka: true,
  tranche: [
    { nomor: 1, persen: 50, tahunKe: 1 },
    { nomor: 2, persen: 35, tahunKe: 2 },
    { nomor: 3, persen: 15, tahunKe: 3 },
  ],
  porsiRemote: { aktif: false, adaSupport: {}, tanpaSupport: {} },
  supervisorSebagaiPic: {
    aktif: false,
    remote: { adaSupport: {}, tanpaSupport: {} },
    onsite: { adaSupport: {}, tanpaSupport: {} },
  },
};

const users = [
  { id: 'u-dhany', full_name: 'Dhany Wahyu', jabatan: 'Manager', atasan_id: null },
  { id: 'u-yoga', full_name: 'Yoga KS', jabatan: 'Supervisor', atasan_id: 'u-dhany' },
  { id: 'u-taufik', full_name: 'Taufik wahyudi', jabatan: 'Supervisor', atasan_id: 'u-dhany' },
  { id: 'u-ferdinan', full_name: 'Ferdinan Agustinus', jabatan: 'Staff', atasan_id: 'u-yoga' },
  { id: 'u-ade', full_name: 'Ade Rachmatullah', jabatan: 'Staff', atasan_id: 'u-taufik' },
];

const proyek = (o: Record<string, any>) => ({
  id: o.id, project_name: o.nama, category: 'Konfigurasi', assigned_to: o.picId,
  assign_name: o.picNama, status: 'done', requires_controller_automation: false,
  controller_automation_brand: null, pic_type: 'standard' as const, pic_id: o.picId,
  domain_owner: null, mode_penyelesaian: o.mode, installer_name: o.installer ?? null,
  installer_daerah: o.daerah ?? null, bast_date: o.bast, incentive_value: o.nominal,
  sales_name: '', sales_division: '', address: '', product: '',
  created_at: '2026-01-01', due_date: o.bast ?? '2026-01-01',
});

const projects = [
  proyek({ id: 'p1', nama: 'Korlantas TMC Soreang', picId: 'u-taufik', picNama: 'Taufik wahyudi', mode: 'remote', bast: '2026-01-15', nominal: 500000, installer: 'Ridwan Gunawan', daerah: 'Jakarta' }),
  proyek({ id: 'p2', nama: 'Solitaire Billiard & Bar', picId: 'u-ferdinan', picNama: 'Ferdinan Agustinus', mode: 'onsite', bast: '2026-02-20', nominal: 2000000 }),
  proyek({ id: 'p3', nama: 'UIN Pekalongan', picId: 'u-ade', picNama: 'Ade Rachmatullah', mode: 'remote', bast: '2026-06-22', nominal: 2000000, installer: 'Pras', daerah: 'Jogja' }),
  proyek({ id: 'p4', nama: 'BPKP ICT Timur', picId: 'u-yoga', picNama: 'Yoga KS', mode: 'onsite', bast: '2026-02-09', nominal: 1000000 }),
  proyek({ id: 'p5', nama: 'OCS Indonesia', picId: 'u-ade', picNama: 'Ade Rachmatullah', mode: 'onsite', bast: null, nominal: 0 }),
];

async function main() {
  const wb = await bangunWorkbookSummary({
    projects, allUsers: users, supportsMap: new Map(),
    managerName: 'Dhany Wahyu', managerUserId: 'u-dhany',
  }, SKEMA);

  const simpanIdx = process.argv.indexOf('--simpan');
  const target = simpanIdx > -1 ? process.argv[simpanIdx + 1] : path.join(os.tmpdir(), `summary-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(target);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(target);
  const ws = wb2.getWorksheet('Summary Incentive PTS');
  if (!ws) throw new Error('Worksheet "Summary Incentive PTS" tidak ditemukan');
  const teks = (r: number, c: number) => String(ws.getCell(r, c).value ?? '');
  /** Cari baris pertama yang kolom B-nya memuat potongan teks ini. */
  const cariBaris = (potongan: string) => {
    for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 2).includes(potongan)) return r;
    return -1;
  };

  console.log('\n1. Judul memuat tahun pembayaran');
  {
    const judul = teks(2, 2);
    ok('Judul ada', judul.startsWith('Summary Incentive PTS IVP'), judul);
    ok('Judul memuat "Tahun"', judul.includes('Tahun'), judul);
    //  BAST 2026 + tahapan 1/2/3 -> dibayar 2027..2029.
    ok('Rentang tahunnya 2027–2029', judul.includes('2027') && judul.includes('2029'), judul);
  }

  console.log('\n2. Ketiga tabel ada, dengan judul persis seperti contoh');
  {
    ok('Tabel 1 "List Project"', cariBaris('1. List Project') > 0);
    ok('Tabel 2 "Summary Total per Anggota Team PTS"', cariBaris('2. Summary Total per Anggota Team PTS') > 0);
    ok('Tabel 3 "Nilai Pengajuan Incentive per Tahun"', cariBaris('3. Nilai Pengajuan Incentive per Tahun') > 0);
    ok('Urutannya 1 -> 2 -> 3',
      cariBaris('1. List Project') < cariBaris('2. Summary Total per Anggota Team PTS')
      && cariBaris('2. Summary Total per Anggota Team PTS') < cariBaris('3. Nilai Pengajuan Incentive per Tahun'));
  }

  console.log('\n3. Kepala Tabel 1 - tiap peran punya kolom Nama/%/Rp sendiri');
  {
    const r = cariBaris('1. List Project') + 1;   // baris kepala pertama
    ok('Kolom dasar No/Project/Mode/BAST/Nominal',
      teks(r, 2) === 'No' && teks(r, 3) === 'Project' && teks(r, 4) === 'Mode'
      && teks(r, 5) === 'BAST' && teks(r, 6) === 'Nominal (Rp)');
    ok('Grup PIC di kolom G', teks(r, 7) === 'PIC');
    ok('Grup Support di kolom J', teks(r, 10) === 'Support');
    ok('Grup Supervisor di kolom M', teks(r, 13) === 'Supervisor');
    ok('Grup Manager di kolom P', teks(r, 16) === 'Manager');
    ok('Grup Installer di kolom S', teks(r, 19) === 'Installer');
    const sub = r + 1;
    ok('Sub-kepala PIC: Nama/%/Rp',
      teks(sub, 7) === 'Nama' && teks(sub, 8) === '%' && teks(sub, 9) === 'Rp');
    ok('Sub-kepala Installer: Nama/Lokasi/%/Rp',
      teks(sub, 19) === 'Nama' && teks(sub, 20) === 'Lokasi'
      && teks(sub, 21) === '%' && teks(sub, 22) === 'Rp');
  }

  console.log('\n4. Tema warna sesuai contoh');
  {
    const r = cariBaris('1. List Project') + 1;
    ok('Kepala tabel navy 1F3864', (ws.getCell(r, 2).fill as any)?.fgColor?.argb === '1F3864');
    ok('Sub-kepala biru 2E5395', (ws.getCell(r + 1, 8).fill as any)?.fgColor?.argb === '2E5395');
  }

  console.log('\n5. Isi Tabel 1 benar');
  {
    const awal = cariBaris('1. List Project') + 3;
    ok('Proyek pertama Korlantas', teks(awal, 3) === 'Korlantas TMC Soreang');
    ok('Nominalnya 500.000', ws.getCell(awal, 6).value === 500000);
    ok('PIC-nya Taufik wahyudi', teks(awal, 7) === 'Taufik wahyudi');
    ok('Installer-nya Ridwan Gunawan', teks(awal, 19) === 'Ridwan Gunawan');
    ok('Lokasi installer Jakarta', teks(awal, 20) === 'Jakarta');
    //  Proyek tanpa nominal ditandai, bukan diam-diam nol.
    const rOcs = (() => { for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 3).includes('OCS')) return r; return -1; })();
    ok('Proyek tanpa nominal ditandai "belum input"', teks(rOcs, 6) === 'belum input');
  }

  console.log('\n6. TOTAL & GRAND TOTAL terisi (bukan sel kosong)');
  {
    const rTotal = cariBaris('TOTAL');
    const cTotal = ws.getCell(rTotal, 6);
    //  4 proyek bernominal: 500rb + 2jt + 2jt + 1jt = 5,5jt (OCS belum input).
    ok('TOTAL Tabel 1 = 5.500.000', cTotal.result === 5500000, String(cTotal.result));

    let gtCount = 0;
    for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 2) === 'GRAND TOTAL') gtCount++;
    ok('Ada dua GRAND TOTAL (Tabel 2 & 3)', gtCount === 2, String(gtCount));
  }

  console.log('\n7. Installer tidak ikut Tabel 2 (bukan Team PTS), tapi ada di Tabel 3');
  {
    const r2 = cariBaris('2. Summary Total per Anggota Team PTS');
    const r3 = cariBaris('3. Nilai Pengajuan Incentive per Tahun');
    let installerDiT2 = false;
    for (let r = r2; r < r3; r++) if (teks(r, 2).includes('Ridwan')) installerDiT2 = true;
    ok('Ridwan (installer) TIDAK ada di Tabel 2', !installerDiT2);

    let installerDiT3 = false;
    for (let r = r3; r <= ws.rowCount; r++) if (teks(r, 2).includes('Ridwan')) installerDiT3 = true;
    ok('Ridwan ADA di Tabel 3', installerDiT3);
  }

  console.log('\n8. Tanda tangan & tanggal ada');
  {
    let adaTanggal = false, adaTtd = false;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (teks(r, 2).startsWith('Jakarta,')) adaTanggal = true;
      if (teks(r, 2) === 'Di buat oleh,') adaTtd = true;
    }
    ok('Baris tanggal "Jakarta, ..."', adaTanggal);
    ok('Blok tanda tangan "Di buat oleh,"', adaTtd);
  }

  // ── Ekspor Pengajuan: SATU KOHORT BAST, 3 tabel ─────────────────────────
  /*
    Kohort BAST 2026 = p1..p4 (p5 tanpa BAST, tidak ikut - persis Summary).
    Tahap 1 project p1 (Korlantas) sudah PROSES (data tersimpan, dua baris
    identik sengaja disisipkan untuk menguji dedup - lihat bug asli di bawah).
    Tahap 2 p1 (2028) dan Tahap 1 p2/Solitaire (2027) BELUM diproses -
    keduanya harus tampil sebagai proyeksi, dipecah dari porsi penuh Tabel 1.
    p1 tidak punya Tahap 3 sama sekali (belum di-generate) - sub-tabel Tahap
    3 harus kosong dengan pesan yang jelas, bukan error atau baris kosong.
  */
  const cohortProjects = projects.filter(p => ['p1', 'p2', 'p3', 'p4'].includes(p.id as string));
  const tranchesKohort = [
    { id: 't1', project_id: 'p1', tranche_number: 1, percentage: 50, payment_year: 2027, status: 'processed' },
    { id: 't2', project_id: 'p1', tranche_number: 2, percentage: 35, payment_year: 2028, status: 'pending' },
    { id: 't3', project_id: 'p2', tranche_number: 1, percentage: 50, payment_year: 2027, status: 'pending' },
  ] as any[];
  const ANGKA_SENTINEL = 999999; // nilai TERSIMPAN yang mustahil sama dengan hasil proyeksi mana pun - membuktikan Tahap 1 p1 memang membaca baris tersimpan, bukan menghitung ulang.
  const splitsKohort = [
    // DUA baris identik untuk Taufik wahyudi (PIC, p1, Tahap 1) - menguji dedup:
    // bug nyata dari laporan, nama tercetak dua kali DAN rupiahnya ikut dijumlah dobel.
    { id: 's1', project_id: 'p1', tranche_id: 't1', role: 'pic', user_id: 'u-taufik', user_name: 'Taufik wahyudi', percentage: 55, amount: ANGKA_SENTINEL },
    { id: 's2', project_id: 'p1', tranche_id: 't1', role: 'pic', user_id: 'u-taufik', user_name: 'Taufik wahyudi', percentage: 55, amount: ANGKA_SENTINEL },
  ] as any[];

  const wbP = await bangunWorkbookPengajuan({
    year: 2026, projects: cohortProjects as any, splits: splitsKohort, tranches: tranchesKohort,
    managerName: 'Dhany Wahyu', directorName: 'Director PT. IVP',
    allUsers: users, supportsMap: new Map(), managerUserId: 'u-dhany',
  } as any, SKEMA);

  const targetP = simpanIdx > -1 ? target.replace(/\.xlsx$/, '-PengajuanBAST2026.xlsx')
    : path.join(os.tmpdir(), `pengajuan-${Date.now()}.xlsx`);
  await wbP.xlsx.writeFile(targetP);
  const wbP2 = new ExcelJS.Workbook();
  await wbP2.xlsx.readFile(targetP);
  const wsP = wbP2.getWorksheet('Pengajuan BAST 2026');
  if (!wsP) throw new Error('Worksheet "Pengajuan BAST 2026" tidak ditemukan');
  const teksP = (r: number, c: number) => String(wsP.getCell(r, c).value ?? '');
  const angka = (v: unknown) => (typeof v === 'object' && v ? (v as any).result : v);
  const cariP = (potongan: string, dari = 1) => {
    for (let r = dari; r <= wsP.rowCount; r++) if (teksP(r, 2).includes(potongan) || teksP(r, 3).includes(potongan)) return r;
    return -1;
  };
  /** Kolom sebuah kepala tabel (baris `barisKepala`) yang nilainya PERSIS `nilai`. */
  const cariKolomPersis = (barisKepala: number, nilai: string): number => {
    for (let c = 1; c <= wsP.columnCount; c++) {
      if (String(wsP.getCell(barisKepala, c).value ?? '') === nilai) return c;
    }
    return -1;
  };

  console.log('\n9. Tabel 1 & 2 Pengajuan - bentuknya IDENTIK dengan Summary Export, cakupannya kohort BAST');
  {
    ok('Judul menyebut BAST-nya, bukan tahun pembayaran', teksP(2, 2).includes('BAST 2026'), teksP(2, 2));
    const r1 = cariP('1. Seluruh Project');
    ok('Tabel 1 berjudul "Seluruh Project — BAST 2026"', teksP(r1, 2).includes('BAST 2026'));
    //  Project (bukan orang) - namanya di KOLOM 3 di Summary, cariBaris cuma
    //  membaca kolom 2 (dipakai untuk nama ORANG di Tabel 2/3), jadi dicari manual.
    const rProjSummary = (() => { for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 3) === 'Korlantas TMC Soreang') return r; return -1; })();
    const rProjPengajuan = cariP('Korlantas TMC Soreang');
    ok('Korlantas ditemukan di Tabel 1 Pengajuan', rProjPengajuan > 0);
    //  SAMA PERSIS dengan Summary - bukti kedua berkas tidak bisa menyimpang:
    //  keduanya memanggil hitungDaftarProyekPenuh() yang sama.
    const kolPoolS = (() => { for (let c = 1; c <= ws.columnCount; c++) if (teks(rProjSummary - 2, c) === 'Nominal (Rp)') return c; return -1; })();
    const kolPoolP = cariKolomPersis(r1 + 1, 'Nilai Project (Rp)');
    ok('Nilai Project Korlantas di Pengajuan = Nominal Korlantas di Summary (byte-identik)',
      ws.getCell(rProjSummary, kolPoolS).value === wsP.getCell(rProjPengajuan, kolPoolP).value,
      `Summary=${ws.getCell(rProjSummary, kolPoolS).value} Pengajuan=${wsP.getCell(rProjPengajuan, kolPoolP).value}`);

    const r2 = cariP('2. Summary Total per Anggota');
    ok('Tabel 2 berjudul "Summary Total per Anggota ... BAST 2026"', teksP(r2, 2).includes('BAST 2026'));
    const rHdr2 = r2 + 1;
    const kolTotal2 = (() => { for (let c = 1; c <= wsP.columnCount; c++) if (teksP(rHdr2, c).includes('Total Nominal')) return c; return -1; })();
    ok('Kolom "Total Nominal (Rp)" ditemukan di Tabel 2 Pengajuan (label sama seperti Summary)', kolTotal2 > 0);
    const rTaufik2 = (() => { for (let r = rHdr2; r <= rHdr2 + 10; r++) if (teksP(r, 2) === 'Taufik wahyudi') return r; return -1; })();
    ok('Taufik ditemukan di Tabel 2 Pengajuan', rTaufik2 > 0);
    ok('Total Taufik di Tabel 2 Pengajuan = RUMUS (bukan angka mati)', typeof wsP.getCell(rTaufik2, kolTotal2).value === 'object');

    const r3 = cariP('3. Pengajuan Pencairan per Tahap');
    ok('Tabel 3 "Pengajuan Pencairan per Tahap" ada, SETELAH Tabel 1 & 2', r3 > r2 && r2 > r1);
  }

  console.log('\n10. Tabel 3 - tiga sub-tabel per tahap, tersimpan vs proyeksi, dedup, rumus');
  {
    const rTahap1 = cariP('Tahap 1 · Pencairan 2027');
    const rTahap2 = cariP('Tahap 2 · Pencairan 2028');
    ok('Sub-tabel Tahap 1 berjudul "Pencairan 2027" (payment_year dari tranche tersimpan)', rTahap1 > 0);
    ok('Sub-tabel Tahap 2 berjudul "Pencairan 2028"', rTahap2 > 0 && rTahap2 > rTahap1);

    //  Tahap 1 p1: data TERSIMPAN (dua baris ganda) - harus pakai ANGKA_SENTINEL,
    //  BUKAN dijumlah dobel jadi 2x ANGKA_SENTINEL, dan namanya tidak dobel cetak.
    const rh1 = rTahap1 + 1; // k1A tahap 1 (tanpa catatan proyeksi - Tahap 1 tidak selalu proyeksi)
    const kolTaufikT1 = cariKolomPersis(rh1, 'Taufik wahyudi');
    ok('Kolom Taufik ditemukan di Tahap 1', kolTaufikT1 > 0);
    const rKorlantasT1 = rh1 + 2; // baris data pertama sub-tabel (satu project: Korlantas)
    ok('Sel Sebagai Taufik "PIC" saja (bukan "PIC, PIC")', teksP(rKorlantasT1, kolTaufikT1) === 'PIC');
    ok(`Rupiah PIC Taufik Tahap 1 = ${ANGKA_SENTINEL} (data tersimpan, TIDAK dijumlah dobel jadi ${ANGKA_SENTINEL * 2})`,
      wsP.getCell(rKorlantasT1, kolTaufikT1 + 2).value === ANGKA_SENTINEL,
      String(wsP.getCell(rKorlantasT1, kolTaufikT1 + 2).value));
    const cStatusT1 = teksP(rKorlantasT1, 5);
    ok('Status Tahap 1 Korlantas TIDAK bertanda "(proyeksi)" - data sudah tersimpan/processed',
      !cStatusT1.includes('proyeksi'), cStatusT1);

    //  Tahap 2 p1: BELUM diproses - proyeksi, dipecah dari porsi penuh Tabel 1
    //  (BUKAN dari ANGKA_SENTINEL milik Tahap 1 - keduanya sumber berbeda).
    const catatanTahap2 = teksP(rTahap2 + 1, 2);
    ok('Catatan "nilai sementara" muncul SEBELUM tabel Tahap 2 (bukan sesudah)',
      catatanTahap2.includes('sementara') && catatanTahap2.includes('Support'), catatanTahap2);
    const rh2 = rTahap2 + 2; // ada baris catatan proyeksi sebelum kepala tabel
    const kolDhanyT2 = cariKolomPersis(rh2, 'Dhany Wahyu');
    ok('Kolom Dhany (Manager) ditemukan di Tahap 2', kolDhanyT2 > 0);
    const rKorlantasT2 = rh2 + 2;
    const cStatusT2 = teksP(rKorlantasT2, 5);
    ok('Status Tahap 2 Korlantas bertanda "(proyeksi)"', cStatusT2.includes('proyeksi'), cStatusT2);
    //  Porsi penuh Dhany di Tabel 1 (kolom Manager) x 35% (persen Tahap 2) -
    //  dibandingkan LANGSUNG ke Tabel 1 Pengajuan, bukan angka hardcode, supaya
    //  tes ini tetap benar walau SKEMA di atas berubah persentasenya.
    const kolMgrT1 = cariKolomPersis(cariP('1. Seluruh Project') + 1, 'Manager');
    const rKorlantasTabel1 = cariP('Korlantas TMC Soreang');
    const dhanyPenuh = angka(wsP.getCell(rKorlantasTabel1, kolMgrT1 + 2).value);
    const dhanyTahap2Diharapkan = Math.round((dhanyPenuh * 35) / 100);
    ok('Rupiah Dhany Tahap 2 = porsi penuh Tabel 1 × 35% (dibulatkan), bukan angka lain',
      wsP.getCell(rKorlantasT2, kolDhanyT2 + 2).value === dhanyTahap2Diharapkan,
      `penuh=${dhanyPenuh} diharapkan=${dhanyTahap2Diharapkan} aktual=${wsP.getCell(rKorlantasT2, kolDhanyT2 + 2).value}`);

    //  Tahap 3: BELUM PERNAH di-generate sama sekali (tidak ada baris tranche) -
    //  sub-tabelnya tetap ada dengan pesan jelas, bukan hilang/error.
    const rTahap3 = cariP('Tahap 3 · Pencairan');
    ok('Sub-tabel Tahap 3 tetap ada walau belum ada project yang di-generate', rTahap3 > 0 && rTahap3 > rTahap2);
    let adaPesanKosong = false;
    for (let r = rTahap3; r <= rTahap3 + 5; r++) if (teksP(r, 2).includes('Belum ada project')) adaPesanKosong = true;
    ok('Tahap 3 menampilkan pesan "Belum ada project ... di-generate", bukan baris kosong tanpa keterangan', adaPesanKosong);

    //  TOTAL Tahap 1 - RUMUS, dan Solitaire (p2, Tahap 1 proyeksi) juga ikut
    //  muncul di sub-tabel yang SAMA dengan Korlantas (satu tahap = satu tabel,
    //  bukan dipisah per status tersimpan/proyeksi).
    const rSolitaireT1 = cariP('Solitaire Billiard & Bar', rKorlantasT1);
    ok('Solitaire (Tahap 1, proyeksi) muncul di sub-tabel Tahap 1 yang sama dengan Korlantas (tersimpan)',
      rSolitaireT1 > rKorlantasT1 && rSolitaireT1 < rTahap2);
    const rTotalT1 = cariP('TOTAL', rSolitaireT1);
    ok('Baris TOTAL Tahap 1 ada tepat sesudah baris project terakhirnya', rTotalT1 === rSolitaireT1 + 1);
    const kolNominalT1 = cariKolomPersis(rh1, teksP(rh1, 7));
    ok('TOTAL Tahap 1 kolom Pencairan = RUMUS (bukan angka mati)',
      typeof wsP.getCell(rTotalT1, kolNominalT1).value === 'object');
  }

  if (simpanIdx > -1) console.log(`Berkas pengajuan disimpan: ${targetP}`);
  else fs.unlinkSync(targetP);

  console.log('\n8b. Kolom Tabel 1 tidak tertimpa oleh kolom dinamis Tabel 3');
  {
    //  Ini bug nyata yang pernah lolos: Tabel 3 menaruh kolom per-tahun mulai
    //  dari kolom yang SAMA dengan kolom Nominal/PIC/Support Tabel 1 (mereka
    //  berbagi satu grid kolom worksheet). Menimpa lebar kolom di sana dengan
    //  `.width = angka` langsung mengecilkan kolom Tabel 1 yang sudah lebih
    //  lebar - persis penyebab Nominal tampil "########" dan nama peran
    //  tumpang tindih.
    ok('Kolom Nominal (F) tetap >= 15 walau Tabel 3 memakai kolom yang sama',
      (ws.getColumn(6).width ?? 0) >= 15, String(ws.getColumn(6).width));
    ok('Kolom Nama PIC (G) tetap >= 17', (ws.getColumn(7).width ?? 0) >= 17, String(ws.getColumn(7).width));
    ok('Kolom Nama Support (J) tetap >= 17', (ws.getColumn(10).width ?? 0) >= 17, String(ws.getColumn(10).width));
  }

  console.log('\n8c. Tinggi baris menyesuaikan nama yang panjang - bukan angka tetap');
  {
    //  "Taufik wahyudi" (PIC proyek pertama) pas di satu baris pada kolom
    //  selebar 17 karakter. Baris dengan nama yang melipat ke baris kedua
    //  harus lebih tinggi daripada baris bernama pendek, kalau tidak ia
    //  terpotong/tumpang tindih secara visual.
    const rSatuNama = cariBaris('1. List Project') + 3; // baris data pertama
    const tinggiSatuBaris = ws.getRow(rSatuNama).height ?? 0;
    ok('Baris dengan nama pendek punya tinggi wajar (bukan nol/undefined)', tinggiSatuBaris >= 20, String(tinggiSatuBaris));
    ok('Bukan lagi angka tetap 18px yang terlalu pendek untuk teks berlipat', tinggiSatuBaris !== 18, String(tinggiSatuBaris));
  }

  if (simpanIdx > -1) console.log(`\nBerkas disimpan: ${target}`);
  else fs.unlinkSync(target);

  console.log('\n13. Filter Tahun BAST pada Export Summary (fitur baru)');
  {
    //  Kelima proyek contoh semuanya BAST 2026 (p5 tanpa BAST sama sekali).
    //  Filter ke 2026 harus tetap menampilkan seluruh proyek yang punya BAST -
    //  filter TIDAK BOLEH diam-diam membuang data yang sebenarnya cocok.
    const wb2026 = await bangunWorkbookSummary({
      projects, allUsers: users, supportsMap: new Map(),
      managerName: 'Dhany Wahyu', managerUserId: 'u-dhany', year: 2026,
    }, SKEMA);
    const target2026 = path.join(os.tmpdir(), `summary-2026-${Date.now()}.xlsx`);
    await wb2026.xlsx.writeFile(target2026);
    const wbBaca2026 = new ExcelJS.Workbook();
    await wbBaca2026.xlsx.readFile(target2026);
    const ws2026 = wbBaca2026.getWorksheet('Summary Incentive PTS')!;
    const teks2026 = (r: number, c: number) => String(ws2026.getCell(r, c).value ?? '');
    const judul2026 = teks2026(2, 2);
    ok('Judul filter 2026 menyebut "Project BAST 2026"', judul2026.includes('Project BAST 2026'), judul2026);
    let barisProyek2026 = 0;
    for (let r = 1; r <= ws2026.rowCount; r++) {
      for (const nama of ['Korlantas TMC Soreang', 'Solitaire Billiard & Bar', 'UIN Pekalongan', 'BPKP ICT Timur']) {
        if (teks2026(r, 3) === nama) barisProyek2026++;
      }
    }
    ok('Keempat proyek BAST 2026 tetap muncul saat difilter ke 2026', barisProyek2026 === 4, String(barisProyek2026));
    fs.unlinkSync(target2026);

    //  Filter ke tahun yang TIDAK ADA proyeknya (2099) harus menghasilkan
    //  Tabel 1 kosong dari proyek - bukti filter benar-benar menyaring, bukan
    //  cuma mengubah judul sambil tetap mencetak semua data.
    const wbKosong = await bangunWorkbookSummary({
      projects, allUsers: users, supportsMap: new Map(),
      managerName: 'Dhany Wahyu', managerUserId: 'u-dhany', year: 2099,
    }, SKEMA);
    const targetKosong = path.join(os.tmpdir(), `summary-2099-${Date.now()}.xlsx`);
    await wbKosong.xlsx.writeFile(targetKosong);
    const wbBacaKosong = new ExcelJS.Workbook();
    await wbBacaKosong.xlsx.readFile(targetKosong);
    const wsKosong = wbBacaKosong.getWorksheet('Summary Incentive PTS')!;
    const teksKosong = (r: number, c: number) => String(wsKosong.getCell(r, c).value ?? '');
    ok('Judul filter 2099 menyebut "Project BAST 2099"', teksKosong(2, 2).includes('Project BAST 2099'), teksKosong(2, 2));
    let adaProyekAsing = false;
    for (let r = 1; r <= wsKosong.rowCount; r++) {
      for (const nama of ['Korlantas TMC Soreang', 'Solitaire Billiard & Bar', 'UIN Pekalongan', 'BPKP ICT Timur', 'OCS Indonesia']) {
        if (teksKosong(r, 3) === nama) adaProyekAsing = true;
      }
    }
    ok('Tahun 2099 (tidak ada proyeknya) tidak mencetak satu pun proyek dari tahun lain', !adaProyekAsing);
    fs.unlinkSync(targetKosong);

    //  Tanpa `year` sama sekali (perilaku lama) harus tetap all-years - fitur
    //  baru tidak boleh mengubah default siapa pun yang belum pakai filternya.
    //  `ws`/`teks` di sini masih merujuk workbook TANPA filter dari bagian
    //  atas berkas ini (dibuat sebelum year ditambahkan ke DataSummary).
    ok('Tanpa year sama sekali, judul awal (Tabel 1 utama di atas) TIDAK menyebut "Project BAST"',
      !teks(2, 2).includes('Project BAST'), teks(2, 2));
  }

  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

main();
