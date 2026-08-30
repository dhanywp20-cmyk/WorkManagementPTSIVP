/*
  UJI: Installer lunas sekali, Tim PTS tetap dipecah tiga tahun.

  Ini menguji hal yang paling mudah salah tanggap pada kebijakan insentif, dan
  yang memang PERNAH salah di kode ini: "Installer dibayar penuh di tahun
  pertama" sempat diterjemahkan jadi "Installer mengambil alih Tahap 3". Dua
  kalimat itu terdengar mirip, tapi akibatnya jauh berbeda - yang kedua
  MENGHAPUS pencairan tahun ketiga untuk SELURUH Tim PTS, bukan hanya untuk
  Installer.

  Patokan angkanya diambil dari contoh yang ditulis sendiri oleh pemilik
  kebijakan: "Manager porsi pool 10%, nominalnya Rp 500.000, dibagi 3 tahun:
  tahun pertama 50% = 250.000, tahun kedua 35% = 175.000, tahun ketiga 15% =
  75.000". Kalau uji ini gagal, yang berubah bukan kode - melainkan janji
  kepada orang yang dibayar.
*/

import { type SkemaInsentif, persenPicBerlaku, petaPorsiBerlaku } from '../lib/incentive-scheme';
import { generateTranches } from '../app/incentive-pts/_components/calc';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}
function sama(nama: string, dapat: unknown, harap: unknown) {
  ok(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

const SKEMA: SkemaInsentif = {
  versi: 3,
  porsi: [
    { peran: 'pic',        label: 'PIC',        persen: 60, bagiRata: true  },
    { peran: 'support',    label: 'Support',    persen: 17, bagiRata: true  },
    { peran: 'supervisor', label: 'Supervisor', persen: 15, bagiRata: true  },
    { peran: 'manager',    label: 'Manager',    persen: 8,  bagiRata: false },
  ],
  tanpaSupport: { pic: 77, supervisor: 15, manager: 8 },
  jendelaSupportBulan: 12,
  hangusSupervisorKe: 'manager',
  managerSebagaiPic: { adaSupport: { pic: 100 }, tanpaSupport: { pic: 100 } },
  installerAktif: true,
  installerRemotePersen: 15,
  installerHanyaRemote: true,
  installerBayarDiMuka: true,
  //  Tabel Porsi Remote AKTIF, dengan angka proposal Bagian B - persis seperti
  //  keadaan produksi. Sebelum uji ini ada, jalur inilah yang tidak pernah
  //  diperiksa, dan di situlah layar daftar menampilkan 51% alih-alih 40%.
  porsiRemote: {
    aktif: true,
    adaSupport:   { pic: 40, support: 15, supervisor: 20, manager: 10, installer: 15 },
    tanpaSupport: { pic: 55, support: 0,  supervisor: 20, manager: 10, installer: 15 },
  },
  tranche: [
    { nomor: 1, persen: 50, tahunKe: 1 },
    { nomor: 2, persen: 35, tahunKe: 2 },
    { nomor: 3, persen: 15, tahunKe: 3 },
  ],
  supervisorSebagaiPic: {
    aktif: false,
    remote: { adaSupport: {}, tanpaSupport: {} },
    onsite: { adaSupport: {}, tanpaSupport: {} },
  },
};

console.log('\n1. Tahun pencairan: BAST 2026 dicairkan 2027 / 2028 / 2029');
{
  const onsite = generateTranches(SKEMA, 'p1', '2026-06-25', 'onsite');
  sama('Onsite: tahun bayar', onsite.map(t => t.payment_year), [2027, 2028, 2029]);
  sama('Onsite: persentase tahap', onsite.map(t => t.percentage), [50, 35, 15]);

  //  Inilah perbaikannya. Sebelumnya tahap 3 dipindah ke 2027 supaya bisa
  //  dipakai Installer, sehingga proyek Remote tidak punya pencairan 2029.
  const remote = generateTranches(SKEMA, 'p2', '2026-06-22', 'remote');
  sama('Remote: tahun bayar SAMA dengan Onsite', remote.map(t => t.payment_year), [2027, 2028, 2029]);
  ok('Remote tetap punya pencairan tahun ke-3', remote.some(t => t.payment_year === 2029));
}

console.log('\n2. Proyek Desember tetap masuk rekap tahun berikutnya');
{
  //  Proyek yang BAST-nya akhir Desember 2026 tidak boleh jatuh ke 2026 -
  //  rekapnya dibuat di awal 2027 bersama proyek Januari 2026.
  const desember = generateTranches(SKEMA, 'p3', '2026-12-28', 'onsite');
  sama('BAST 28 Des 2026 -> cair 2027', desember[0].payment_year, 2027);
  const januari = generateTranches(SKEMA, 'p4', '2026-01-05', 'onsite');
  sama('BAST 5 Jan 2026 -> cair 2027 juga', januari[0].payment_year, 2027);
  ok('Keduanya masuk rekap tahun yang sama', desember[0].payment_year === januari[0].payment_year);
}

/*
  Bagian ini meniru perhitungan rupiah processYearlyBatch tanpa menyentuh
  basis data: porsi Installer dipotong dari pool lebih dulu, sisanya milik
  Tim PTS dan itulah yang dipecah menurut tahapan.
*/
function rupiahTahap(pool: number, pctOrang: number, pctInstaller: number, persenTahap: number) {
  const poolTim = pool * ((100 - pctInstaller) / 100);
  // pctOrang adalah persen terhadap pool penuh (mis. Manager 8% x 85% = 6,8%)
  const porsiOrangDiPoolTim = pctOrang / ((100 - pctInstaller) / 100) / 100;
  return Math.round(poolTim * porsiOrangDiPoolTim * (persenTahap / 100));
}

console.log('\n3. Contoh dari pemilik kebijakan: porsi Rp 500.000 dibagi 3 tahun');
{
  //  "Manager porsi pool 10% dan nominalnya 500.000, dibagi 3 tahun:
  //   tahun pertama 50% = 250.000, kedua 35% = 175.000, ketiga 15% = 75.000"
  const pool = 5_000_000;
  const porsi = 10;               // 10% dari pool = Rp 500.000
  const tahun = [50, 35, 15].map(p => rupiahTahap(pool, porsi, 0, p));
  sama('Tahun 1 = 50% dari porsinya', tahun[0], 250_000);
  sama('Tahun 2 = 35% dari porsinya', tahun[1], 175_000);
  sama('Tahun 3 = 15% dari porsinya', tahun[2], 75_000);
  sama('Jumlah tiga tahun = porsinya utuh', tahun[0] + tahun[1] + tahun[2], 500_000);
}

console.log('\n4. Remote: Installer lunas sekali, Tim PTS tetap bertahap');
{
  const pool = 5_000_000;
  const pctInst = 15;

  //  Installer: 15% x 5 juta = 750.000, dibayar SEKALI di tahap pertama.
  const installer = Math.round((pool * pctInst) / 100);
  sama('Installer terima sekaligus', installer, 750_000);

  //  Manager pada proyek Remote (skema turunan): 8% x 85% = 6,8% dari pool.
  const pctManagerRemote = 8 * 0.85;                       // 6,8%
  const t = [50, 35, 15].map(p => rupiahTahap(pool, pctManagerRemote, pctInst, p));
  sama('Manager tahun 1', t[0], 170_000);
  sama('Manager tahun 2', t[1], 119_000);
  sama('Manager tahun 3 TIDAK nol', t[2], 51_000);
  ok('Manager tetap dibayar tiga kali di proyek Remote', t.every(v => v > 0));
  sama('Jumlahnya = 6,8% dari pool', t[0] + t[1] + t[2], 340_000);

  //  Yang paling penting: seluruh pool tetap habis, tidak lebih & tidak kurang.
  const pctSemuaTim = [60, 17, 15, 8].map(p => p * 0.85);  // 51 + 14,45 + 12,75 + 6,8 = 85
  const totalTim = pctSemuaTim.reduce(
    (n, pct) => n + [50, 35, 15].reduce((m, p) => m + rupiahTahap(pool, pct, pctInst, p), 0), 0);
  sama('Tim PTS total = 85% pool', totalTim, 4_250_000);
  sama('Tim + Installer = pool utuh', totalTim + installer, pool);
}

console.log('\n5. Onsite tidak terpengaruh sama sekali');
{
  const pool = 5_000_000;
  //  Tanpa Installer, tiap peran menerima porsinya dipecah 50/35/15.
  const pic = [50, 35, 15].map(p => rupiahTahap(pool, 60, 0, p));
  sama('PIC 60% -> 1.500.000 / 1.050.000 / 450.000', pic, [1_500_000, 1_050_000, 450_000]);
  sama('PIC total = 60% pool', pic[0] + pic[1] + pic[2], 3_000_000);
}

console.log('\n6. Tabel Porsi Remote yang diatur sendiri DIHORMATI layar & mesin bayar');
{
  //  Bug yang ditemukan lewat screenshot UIN Pekalongan: kartu daftar proyek
  //  menulis 51% (porsi Onsite 60 x 0,85) padahal tabel Remote menetapkan 40%.
  //  Layar menghitung sendiri lewat sk.porsi, jalur yang tidak pernah melihat
  //  porsiRemote. Sekarang keduanya lewat petaPorsiBerlaku yang sama.
  const pctPicRemote = persenPicBerlaku(SKEMA, true, true);
  sama('PIC Remote = 40% (tabel Remote), BUKAN 51%', pctPicRemote, 40);

  const pctPicOnsite = persenPicBerlaku(SKEMA, false, true);
  sama('PIC Onsite tetap 60%', pctPicOnsite, 60);

  //  Rp 2.000.000 - persis pool UIN Pekalongan di layar.
  sama('Bagian PIC dari pool Rp 2.000.000', Math.round(2_000_000 * pctPicRemote / 100), 800_000);

  //  Porsi Installer diambil dari BARIS di tabel Remote, bukan dari kolom
  //  "Porsi Installer". Saat keduanya berbeda, yang menang harus tabelnya.
  const beda: SkemaInsentif = {
    ...SKEMA,
    installerRemotePersen: 25,          // kolom lama sengaja dibuat berbeda
    porsiRemote: { ...SKEMA.porsiRemote },
  };
  sama('Installer diambil dari tabel Remote (15), bukan kolom (25)',
    petaPorsiBerlaku(beda, true, true).pctInstaller, 15);

  //  Faktor pengali = 1 saat tabel Remote dipakai: angkanya sudah final,
  //  tidak boleh dikali sisa pool sekali lagi (itulah asal 51%).
  sama('Tabel Remote tidak dikali apa pun', petaPorsiBerlaku(SKEMA, true, true).faktor, 1);

  //  Tanpa Support: porsi Support diserap PIC -> 55%, sesuai tabel kedua.
  sama('Remote tanpa Support: PIC 55%', persenPicBerlaku(SKEMA, true, false), 55);

  //  Seluruh tabel tetap berjumlah 100.
  const peta = petaPorsiBerlaku(SKEMA, true, true);
  const totalTim = Object.values(peta.dasar).reduce((a, b) => a + b, 0);
  sama('Tim PTS + Installer = 100%', totalTim + peta.pctInstaller, 100);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
