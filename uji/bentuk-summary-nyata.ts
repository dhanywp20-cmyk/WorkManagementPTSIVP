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

  // ── Ekspor Pengajuan per tahun: pola harus SAMA dengan Summary ──────────
  const tranches = [
    { id: 't1', project_id: 'p1', tranche_number: 1, percentage: 50, payment_year: 2027, status: 'pending' },
    { id: 't2', project_id: 'p1', tranche_number: 2, percentage: 35, payment_year: 2028, status: 'pending' },
    { id: 't3', project_id: 'p2', tranche_number: 1, percentage: 50, payment_year: 2027, status: 'pending' },
  ] as any[];

  const wbP = await bangunWorkbookPengajuan({
    year: 2027,
    projects: projects.filter(p => p.id === 'p1' || p.id === 'p2') as any,
    splits: [], tranches,
    managerName: 'Dhany Wahyu', directorName: 'Director PT. IVP',
    splitsProyeksi: new Map([
      ['p1', [
        { role: 'pic', user_id: 'u-taufik', user_name: 'Taufik wahyudi', percentage: 55, amount: 275000 },
        { role: 'manager', user_id: 'u-dhany', user_name: 'Dhany Wahyu', percentage: 30, amount: 150000 },
        { role: 'installer', user_id: '', user_name: 'Ridwan Gunawan', percentage: 15, amount: 75000 },
      ]],
      ['p2', [
        { role: 'pic', user_id: 'u-ferdinan', user_name: 'Ferdinan Agustinus', percentage: 55, amount: 1100000 },
        { role: 'manager', user_id: 'u-dhany', user_name: 'Dhany Wahyu', percentage: 15, amount: 300000 },
      ]],
    ]) as any,
  } as any, SKEMA);

  const targetP = simpanIdx > -1 ? target.replace(/\.xlsx$/, '-Pengajuan2027.xlsx')
    : path.join(os.tmpdir(), `pengajuan-${Date.now()}.xlsx`);
  await wbP.xlsx.writeFile(targetP);
  const wbP2 = new ExcelJS.Workbook();
  await wbP2.xlsx.readFile(targetP);
  const wsP = wbP2.getWorksheet('Pengajuan 2027');
  if (!wsP) throw new Error('Worksheet "Pengajuan 2027" tidak ditemukan');
  const teksP = (r: number, c: number) => String(wsP.getCell(r, c).value ?? '');
  const cariP = (potongan: string) => {
    for (let r = 1; r <= wsP.rowCount; r++) if (teksP(r, 2).includes(potongan)) return r;
    return -1;
  };

  /** Kolom awal grup 3-kolom "Sebagai|%|Rp" milik sebuah project, dicari dari kepala Tabel 1. */
  const cariKolomProyekP = (barisKepala: number, namaProyek: string): number => {
    for (let c = 1; c <= wsP.columnCount; c++) {
      if (String(wsP.getCell(barisKepala, c).value ?? '').includes(namaProyek)) return c;
    }
    return -1;
  };

  console.log('\n9. Ekspor Pengajuan per tahun: Tabel 1 kini baris=ORANG, kolom berulang per project');
  {
    ok('Judul menyebut tahunnya', teksP(2, 2).includes('Tahun 2027'), teksP(2, 2));
    const rh = cariP('1. Project yang Dicairkan') + 1; // k1A
    ok('Kepala "Nama" & "Peran" (menyamai Tabel 2)', teksP(rh, 2) === 'Nama' && teksP(rh, 4) === 'Peran');
    const kolKorlantas = cariKolomProyekP(rh, 'Korlantas TMC Soreang');
    const kolSolitaire = cariKolomProyekP(rh, 'Solitaire Billiard & Bar');
    ok('Kedua project punya kolom grupnya sendiri', kolKorlantas > 0 && kolSolitaire > 0 && kolKorlantas !== kolSolitaire);
    ok('Judul grup project menyebut tahap & persen',
      teksP(rh, kolKorlantas).includes('T1') && teksP(rh, kolKorlantas).includes('50'));
    ok('Sub-kepala "Sebagai | % | Rp" di bawah grup project',
      teksP(rh + 1, kolKorlantas) === 'Sebagai' && teksP(rh + 1, kolKorlantas + 1) === '%' && teksP(rh + 1, kolKorlantas + 2) === 'Rp');
    ok('Ada kolom "Total" di ujung', (() => {
      for (let c = 1; c <= wsP.columnCount; c++) if (teksP(rh, c) === 'Total') return true;
      return false;
    })());
    ok('Tema navy sama', (wsP.getCell(rh, 2).fill as any)?.fgColor?.argb === '1F3864');
    ok('Ada tabel rekap per orang (Tabel 2, tidak berubah)', cariP('2. Nilai Pengajuan per Orang') > 0);
  }

  console.log('\n10. Hanya tahapan tahun itu yang masuk; total per orang benar; installer tabel terpisah');
  {
    const rh = cariP('1. Project yang Dicairkan') + 1;
    const rData = rh + 2; // baris data pertama (k1B + 1)
    const kolKorlantas = cariKolomProyekP(rh, 'Korlantas TMC Soreang');
    const kolSolitaire = cariKolomProyekP(rh, 'Solitaire Billiard & Bar');
    //  Korlantas (p1) punya DUA tahapan (T1/2027, T2/2028) tapi cuma SATU yang
    //  jatuh tempo tahun ini - harus muncul sebagai SATU kolom grup, bukan dua.
    let jumlahGrupSebagai = 0;
    for (let c = 1; c <= wsP.columnCount; c++) if (teksP(rh + 1, c) === 'Sebagai') jumlahGrupSebagai++;
    ok('Tepat 2 grup kolom project (bukan 3 - T2/2028 milik p1 tidak ikut)', jumlahGrupSebagai === 2, String(jumlahGrupSebagai));

    //  Urutan orang: Manager (Dhany) dulu, lalu PIC urut abjad (Ferdinan, Taufik).
    ok('Baris pertama = Dhany Wahyu (Manager)', teksP(rData, 2) === 'Dhany Wahyu', teksP(rData, 2));
    ok('Baris kedua = Ferdinan Agustinus (PIC, abjad F < T)', teksP(rData + 1, 2) === 'Ferdinan Agustinus', teksP(rData + 1, 2));
    ok('Baris ketiga = Taufik wahyudi (PIC)', teksP(rData + 2, 2) === 'Taufik wahyudi', teksP(rData + 2, 2));

    //  Dhany: Manager di KEDUA project - porsi penuh 150.000 (p1) & 300.000 (p2),
    //  masing-masing dipecah 50% (tahap T1) -> 75.000 & 150.000, total 225.000.
    ok('Dhany di kolom Korlantas = 75.000 (50% dari porsi penuh 150.000)',
      wsP.getCell(rData, kolKorlantas + 2).value === 75000, String(wsP.getCell(rData, kolKorlantas + 2).value));
    ok('Dhany di kolom Solitaire = 150.000 (50% dari porsi penuh 300.000)',
      wsP.getCell(rData, kolSolitaire + 2).value === 150000, String(wsP.getCell(rData, kolSolitaire + 2).value));
    const kolTotalP = (() => { for (let c = 1; c <= wsP.columnCount; c++) if (teksP(rh, c) === 'Total') return c; return -1; })();
    ok('Total Dhany = 225.000 (dijumlah dari kedua project, BUKAN dari satu kolom saja)',
      wsP.getCell(rData, kolTotalP).value === 225000 || (wsP.getCell(rData, kolTotalP).value as any)?.result === 225000,
      JSON.stringify(wsP.getCell(rData, kolTotalP).value));

    //  Taufik: PIC hanya di Korlantas - kolom Solitaire-nya harus kosong ("—").
    ok('Taufik di kolom Korlantas = 137.500 (50% dari 275.000)',
      wsP.getCell(rData + 2, kolKorlantas + 2).value === 137500);
    ok('Taufik TIDAK terlibat di Solitaire - kolomnya "—", bukan 0 atau kosong tanpa keterangan',
      teksP(rData + 2, kolSolitaire) === '—');

    //  Installer - tabel kecil terpisah, TIDAK ikut jadi baris di matriks orang.
    ok('Ridwan Gunawan (installer) TIDAK jadi baris di matriks Team PTS', (() => {
      for (let r = rData; r <= rData + 2; r++) if (teksP(r, 2) === 'Ridwan Gunawan') return false;
      return true;
    })());
    let rInstJudul = -1, kolInstNama = -1, kolInstRp = -1;
    for (let r = 1; r <= wsP.rowCount && rInstJudul < 0; r++) {
      for (let c = 1; c <= wsP.columnCount; c++) {
        if (String(wsP.getCell(r, c).value ?? '') === 'Nama Installer') { rInstJudul = r; kolInstNama = c; break; }
      }
    }
    ok('Ada tabel Installer terpisah dengan kepala "Nama Installer"', rInstJudul > 0);
    for (let c = kolInstNama; c <= wsP.columnCount; c++) {
      if (String(wsP.getCell(rInstJudul, c).value ?? '') === 'Rp') { kolInstRp = c; break; }
    }
    const rInstData = rInstJudul + 1;
    ok('Baris Installer: Ridwan Gunawan, lunas 100% di tahun pertama = 75.000',
      teksP(rInstData, kolInstNama) === 'Ridwan Gunawan' && wsP.getCell(rInstData, kolInstRp).value === 75000,
      `${teksP(rInstData, kolInstNama)} / ${wsP.getCell(rInstData, kolInstRp).value}`);
  }

  console.log('\n11. Baris incentive_splits GANDA untuk orang & peran yang sama - tidak dobel dicetak/dijumlah');
  {
    //  Bug nyata dari laporan: nama tercetak dua kali dalam satu sel
    //  ("Taufik wahyudi (55.0%)" berulang) DAN rupiahnya ikut dijumlah jadi
    //  dua kali lipat. Ini terjadi saat incentive_splits punya DUA baris
    //  identik untuk (tranche_id, user_id, role) yang sama - mis. peninggalan
    //  dari sebelum unique index ada, atau Process Batch pernah tertekan dua
    //  kali pada tahapan yang sama.
    const tranchesGanda = [
      { id: 'tg1', project_id: 'p1', tranche_number: 1, percentage: 50, payment_year: 2027, status: 'processed' },
    ] as any[];
    const splitsGanda = [
      // DUA baris identik untuk Taufik wahyudi sebagai PIC pada tahapan yang sama.
      { id: 's1', project_id: 'p1', tranche_id: 'tg1', role: 'pic', user_id: 'u-taufik', user_name: 'Taufik wahyudi', percentage: 55, amount: 137500 },
      { id: 's2', project_id: 'p1', tranche_id: 'tg1', role: 'pic', user_id: 'u-taufik', user_name: 'Taufik wahyudi', percentage: 55, amount: 137500 },
    ] as any[];
    const wbG = await bangunWorkbookPengajuan({
      year: 2027, projects: projects.filter(p => p.id === 'p1') as any,
      splits: splitsGanda, tranches: tranchesGanda,
      managerName: 'Dhany Wahyu', directorName: 'Director PT. IVP',
    } as any, SKEMA);
    const targetG = path.join(os.tmpdir(), `pengajuan-ganda-${Date.now()}.xlsx`);
    await wbG.xlsx.writeFile(targetG);
    const wbG2 = new ExcelJS.Workbook();
    await wbG2.xlsx.readFile(targetG);
    const wsG = wbG2.getWorksheet('Pengajuan 2027');
    if (!wsG) throw new Error('Worksheet "Pengajuan 2027" (ganda) tidak ditemukan');
    const cariBarisG = (potongan: string) => {
      for (let r = 1; r <= wsG.rowCount; r++) if (String(wsG.getCell(r, 2).value ?? '').includes(potongan)) return r;
      return -1;
    };
    const rhG = cariBarisG('1. Project yang Dicairkan') + 1; // k1A
    const rG = rhG + 2; // baris data pertama (satu orang: Taufik)
    const namaSel = String(wsG.getCell(rG, 2).value ?? '');
    ok('Nama orang di kolom Nama TIDAK tercetak dua kali', namaSel === 'Taufik wahyudi', namaSel);
    //  Cari kolom "Sebagai" grup project Korlantas dari kepala tabel.
    let kolSebagai = -1;
    for (let c = 1; c <= wsG.columnCount; c++) if (String(wsG.getCell(rhG + 1, c).value ?? '') === 'Sebagai') { kolSebagai = c; break; }
    ok('Kolom Sebagai ditemukan', kolSebagai > 0);
    ok('Rupiah PIC di kolom project = 137.500 - bukan dijumlah jadi 275.000',
      wsG.getCell(rG, kolSebagai + 2).value === 137500, String(wsG.getCell(rG, kolSebagai + 2).value));
    //  Kolom Total juga harus 137.500, bukan 275.000.
    let kolTotalG = -1;
    for (let c = 1; c <= wsG.columnCount; c++) if (String(wsG.getCell(rhG, c).value ?? '') === 'Total') { kolTotalG = c; break; }
    const totalVal = wsG.getCell(rG, kolTotalG).value as any;
    const totalAngka = typeof totalVal === 'object' && totalVal ? totalVal.result : totalVal;
    ok('Kolom Total = 137.500, bukan dijumlah jadi 275.000', totalAngka === 137500, String(totalAngka));
    fs.unlinkSync(targetG);
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

  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

main();
