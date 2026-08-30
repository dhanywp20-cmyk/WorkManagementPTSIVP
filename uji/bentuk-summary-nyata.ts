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
import { bangunWorkbookSummary } from '../app/incentive-pts/_components/exportPengajuan';
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
  /** Cari kolom pertama pada satu baris yang nilainya PERSIS teks ini - dipakai kolom per-orang yang posisinya dinamis. */
  const cariKolom = (baris: number, nilai: string) => {
    for (let c = 1; c <= ws.columnCount; c++) if (teks(baris, c) === nilai) return c;
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

  console.log('\n3. Kepala Tabel 1 - tiap ORANG (bukan tiap peran) punya kolom Posisi/%/Rp sendiri');
  {
    const r = cariBaris('1. List Project') + 1;   // baris kepala pertama
    ok('Kolom dasar No/Project/Mode/BAST/Nominal',
      teks(r, 2) === 'No' && teks(r, 3) === 'Project' && teks(r, 4) === 'Mode'
      && teks(r, 5) === 'BAST' && teks(r, 6) === 'Nominal (Rp)');
    const kolTaufik = cariKolom(r, 'Taufik wahyudi');
    ok('Grup kolom bernama "Taufik wahyudi" ada (bukan kolom peran "PIC" tetap)', kolTaufik > 0);
    const kolInst = cariKolom(r, 'Installer');
    ok('Grup Installer tetap ada, tidak berubah', kolInst > 0);
    const sub = r + 1;
    ok('Sub-kepala orang: Posisi/%/Rp',
      teks(sub, kolTaufik) === 'Posisi' && teks(sub, kolTaufik + 1) === '%' && teks(sub, kolTaufik + 2) === 'Rp');
    ok('Sub-kepala Installer: Nama/Lokasi/%/Rp',
      teks(sub, kolInst) === 'Nama' && teks(sub, kolInst + 1) === 'Lokasi'
      && teks(sub, kolInst + 2) === '%' && teks(sub, kolInst + 3) === 'Rp');
  }

  console.log('\n4. Tema warna sesuai contoh');
  {
    const r = cariBaris('1. List Project') + 1;
    const kolTaufik = cariKolom(r, 'Taufik wahyudi');
    ok('Kepala tabel navy 1F3864', (ws.getCell(r, 2).fill as any)?.fgColor?.argb === '1F3864');
    ok('Sub-kepala biru 2E5395', (ws.getCell(r + 1, kolTaufik + 1).fill as any)?.fgColor?.argb === '2E5395');
  }

  console.log('\n5. Isi Tabel 1 benar');
  {
    const rKepala = cariBaris('1. List Project') + 1;
    const kolTaufik = cariKolom(rKepala, 'Taufik wahyudi');
    const kolInst = cariKolom(rKepala, 'Installer');

    const awal = cariBaris('1. List Project') + 3;
    ok('Proyek pertama Korlantas', teks(awal, 3) === 'Korlantas TMC Soreang');
    ok('Nominalnya 500.000', ws.getCell(awal, 6).value === 500000);
    ok('Posisi Taufik di proyek ini = PIC', teks(awal, kolTaufik) === 'PIC');
    ok('Installer-nya Ridwan Gunawan', teks(awal, kolInst) === 'Ridwan Gunawan');
    ok('Lokasi installer Jakarta', teks(awal, kolInst + 1) === 'Jakarta');
    //  Proyek tanpa nominal ditandai, bukan diam-diam nol.
    const rOcs = (() => { for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 3).includes('OCS')) return r; return -1; })();
    ok('Proyek tanpa nominal ditandai "belum input"', teks(rOcs, 6) === 'belum input');
  }

  console.log('\n5b. TOTAL per orang - kolom Rp Taufik dijumlah ke bawah, Installer tidak ikut');
  {
    const rKepala = cariBaris('1. List Project') + 1;
    const kolTaufik = cariKolom(rKepala, 'Taufik wahyudi');
    const kolInst = cariKolom(rKepala, 'Installer');
    const awal = cariBaris('1. List Project') + 3;
    const rTotal = cariBaris('TOTAL');
    //  Konsistensi diri: TOTAL harus sama dengan penjumlahan nyata tiap sel
    //  Rp Taufik di baris data - bukan angka tebak-tebakan yang rapuh
    //  terhadap perubahan skema persen.
    let jumlahNyata = 0;
    for (let r = awal; r < rTotal; r++) {
      const v = ws.getCell(r, kolTaufik + 2).value;
      if (v && typeof v === 'object' && 'result' in (v as object)) jumlahNyata += (v as { result: number }).result;
      else if (typeof v === 'number') jumlahNyata += v;
    }
    ok('Taufik muncul di lebih dari satu proyek (PIC + Supervisor Ade)', jumlahNyata > 0, String(jumlahNyata));
    const rpTaufikTotal = ws.getCell(rTotal, kolTaufik + 2);
    ok('TOTAL kolom Rp Taufik terisi rumus SUM', typeof rpTaufikTotal.value === 'object' && rpTaufikTotal.value !== null);
    ok('TOTAL kolom Rp Taufik = jumlah baris-barisnya',
      (rpTaufikTotal as any).result === jumlahNyata, `${(rpTaufikTotal as any).result} vs ${jumlahNyata}`);
    ok('TOTAL kolom Installer kosong (tidak ikut dijumlah di sini)', ws.getCell(rTotal, kolInst + 3).value == null);
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

  console.log('\n8b. Kolom Tabel 1 tidak tertimpa oleh kolom dinamis Tabel 3');
  {
    //  Ini bug nyata yang pernah lolos: Tabel 3 menaruh kolom per-tahun mulai
    //  dari kolom yang SAMA dengan kolom Nominal/orang pertama Tabel 1
    //  (mereka berbagi satu grid kolom worksheet). Menimpa lebar kolom di
    //  sana dengan `.width = angka` langsung mengecilkan kolom Tabel 1 yang
    //  sudah lebih lebar - persis penyebab Nominal tampil "########" dan
    //  Posisi/nama tumpang tindih. perbesarKolom cuma boleh MELEBARKAN.
    const rKepala = cariBaris('1. List Project') + 1;
    const kolTaufik = cariKolom(rKepala, 'Taufik wahyudi');
    const kolInst = cariKolom(rKepala, 'Installer');
    ok('Kolom Nominal (F) tetap >= 15 walau Tabel 3 memakai kolom yang sama',
      (ws.getColumn(6).width ?? 0) >= 15, String(ws.getColumn(6).width));
    ok('Kolom Posisi orang pertama tetap >= 12', (ws.getColumn(kolTaufik).width ?? 0) >= 12, String(ws.getColumn(kolTaufik).width));
    ok('Kolom Rp orang pertama tetap >= 14', (ws.getColumn(kolTaufik + 2).width ?? 0) >= 14, String(ws.getColumn(kolTaufik + 2).width));
    ok('Kolom Nama Installer tetap >= 17 (grup ini tidak berubah)', (ws.getColumn(kolInst).width ?? 0) >= 17, String(ws.getColumn(kolInst).width));
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

  console.log('\n9. Catatan proyeksi Tahap 2 & 3 di bawah Tabel 3 (satu-satunya berkas Excel sekarang)');
  {
    //  Bukan penanda per KOLOM (tahun kalender berbeda arti tahap-ke-berapa
    //  untuk tiap orang, tergantung BAST proyeknya) - dicek sebagai catatan
    //  teks di bawah GRAND TOTAL Tabel 3, lihat alasannya di kode.
    let baris = -1;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (teks(r, 2).includes('masih PROYEKSI')) { baris = r; break; }
    }
    ok('Catatan proyeksi Tahap 2 & 3 ada di bawah Tabel 3', baris > 0);
    ok('Catatan menyebut alasannya (Support baru bisa mengubah nominal)',
      baris > 0 && teks(baris, 2).includes('Support'), baris > 0 ? teks(baris, 2) : '(tidak ditemukan)');
    const rGrandTotal3 = (() => {
      for (let r = 1; r <= ws.rowCount; r++) if (teks(r, 2) === 'GRAND TOTAL' && r > cariBaris('3. Nilai Pengajuan')) return r;
      return -1;
    })();
    ok('Catatan muncul SESUDAH GRAND TOTAL Tabel 3 (bukan sebelum/di tengah)', baris > rGrandTotal3);
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

  console.log('\n14. Filter projectIds + batchYearLabel (tombol Export di Tranche Schedule)');
  {
    //  Simulasi tombol Export batch tahun bayar 2027: hanya 2 dari 5 project
    //  contoh yang "masuk batch" itu (project_id eksplisit), independen dari
    //  BAST-nya masing-masing - beda sumbu filter dari `year` di atas.
    const wbBatch = await bangunWorkbookSummary({
      projects, allUsers: users, supportsMap: new Map(),
      managerName: 'Dhany Wahyu', managerUserId: 'u-dhany',
      projectIds: ['p1', 'p4'], batchYearLabel: 2027,
    }, SKEMA);
    const targetBatch = path.join(os.tmpdir(), `summary-batch2027-${Date.now()}.xlsx`);
    await wbBatch.xlsx.writeFile(targetBatch);
    const wbBacaBatch = new ExcelJS.Workbook();
    await wbBacaBatch.xlsx.readFile(targetBatch);
    const wsBatch = wbBacaBatch.getWorksheet('Summary Incentive PTS')!;
    const teksBatch = (r: number, c: number) => String(wsBatch.getCell(r, c).value ?? '');
    const judulBatch = teksBatch(2, 2);
    ok('Judul menyebut "Project Batch Tahun Bayar 2027"', judulBatch.includes('Project Batch Tahun Bayar 2027'), judulBatch);
    let hitungMasuk = 0, adaYangSeharusnyaTidakMasuk = false;
    for (let r = 1; r <= wsBatch.rowCount; r++) {
      if (teksBatch(r, 3) === 'Korlantas TMC Soreang' || teksBatch(r, 3) === 'BPKP ICT Timur') hitungMasuk++;
      if (teksBatch(r, 3) === 'Solitaire Billiard & Bar' || teksBatch(r, 3) === 'UIN Pekalongan' || teksBatch(r, 3) === 'OCS Indonesia') adaYangSeharusnyaTidakMasuk = true;
    }
    ok('Kedua project di projectIds (p1, p4) muncul', hitungMasuk === 2, String(hitungMasuk));
    ok('Project DI LUAR projectIds tidak ikut tercetak', !adaYangSeharusnyaTidakMasuk);
    fs.unlinkSync(targetBatch);
  }

  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

main();
