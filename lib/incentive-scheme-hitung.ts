/** incentive-scheme-hitung.ts - dipecah dari incentive-scheme.ts (scripts/pecah-modul.mjs); incentive-scheme.ts tetap mengekspor ulang semuanya. */
import { bagikanTepat, persenInstaller } from './incentive-scheme-aturan';
import { SkemaInsentif } from './incentive-scheme-tipe';

// Perhitungan

export interface PenerimaPeran {
  peran: string;
  user_id: string;
  user_name: string;
}

export interface HasilBagi {
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

/**
 * Peta porsi yang BERLAKU untuk sebuah proyek, sesudah saklar Remote diterapkan.
 *
 * SATU-SATUNYA tempat aturan "pakai tabel Remote atau turunkan dari Onsite?"
 * ditulis. Dulu aturan ini hanya hidup di dalam hitungPembagian, sementara
 * layar daftar proyek menghitung bagian PIC-nya sendiri dari `sk.porsi` dikali
 * sisa pool - jalur yang TIDAK pernah melihat tabel Remote. Akibatnya, pada
 * proyek Remote yang tabelnya diatur sendiri, layar menulis 51% (60 x 0,85)
 * sementara yang benar-benar dibayar 40%. Dua angka untuk satu hal, dan yang
 * salah justru yang dibaca orang tiap hari.
 *
 * @returns `dasar`        peta peran -> persen, TANPA baris installer
 * @returns `pctInstaller` porsi Installer yang berlaku
 * @returns `faktor`       pengali untuk `dasar` (1 bila memakai tabel Remote,
 *                         sebab angkanya sudah final; (100-installer)/100 bila
 *                         diturunkan dari porsi Onsite)
 */
export function petaPorsiBerlaku(
  sk: SkemaInsentif,
  remote: boolean,
  adaSupport: boolean,
): { dasar: Record<string, number>; pctInstaller: number; faktor: number } {
  const pakaiPetaRemote = remote && sk.porsiRemote?.aktif === true;

  const dasar: Record<string, number> = pakaiPetaRemote
    ? { ...(adaSupport ? sk.porsiRemote.adaSupport : sk.porsiRemote.tanpaSupport) }
    : adaSupport
      ? Object.fromEntries(sk.porsi.map(p => [p.peran, p.persen]))
      : { ...sk.tanpaSupport };

  //  Installer dikeluarkan dari peta supaya tidak ikut perulangan peran di
  //  pemanggil - ia tidak punya baris penerima, jadi akan terlewat begitu saja
  //  dan porsinya hilang tanpa jejak.
  const pctInstaller = pakaiPetaRemote
    ? Math.max(0, Math.min(99, dasar.installer || 0))
    : persenInstaller(sk, remote);
  if (pakaiPetaRemote) delete dasar.installer;

  return { dasar, pctInstaller, faktor: pakaiPetaRemote ? 1 : (100 - pctInstaller) / 100 };
}

/**
 * Porsi seorang PIC dalam persen dari pool, untuk RINGKASAN di layar daftar.
 *
 * Memakai petaPorsiBerlaku yang sama dengan mesin pembayaran, jadi angka di
 * kartu tidak bisa lagi berbeda dari angka yang benar-benar dibayarkan.
 */
export function persenPicBerlaku(
  sk: SkemaInsentif,
  remote: boolean,
  adaSupport: boolean,
  managerSebagaiPic = false,
): number {
  const { dasar, faktor } = petaPorsiBerlaku(sk, remote, adaSupport);
  if (managerSebagaiPic) {
    //  Manager-sebagai-PIC punya petanya sendiri; porsi Installer tetap
    //  dipotong lebih dulu, persis seperti hitungManagerSebagaiPic.
    const peta = adaSupport ? sk.managerSebagaiPic.adaSupport : sk.managerSebagaiPic.tanpaSupport;
    return (peta.pic ?? 100) * ((100 - persenInstaller(sk, remote)) / 100);
  }
  return (dasar.pic || 0) * faktor;
}

/**
 * Hitung pembagian satu proyek berdasarkan skema.
 *
 * @param pool          nilai insentif proyek (rupiah)
 * @param remote        proyek diselesaikan secara remote
 * @param penerima      daftar orang per peran; satu peran boleh diisi banyak
 *                      orang bila porsinya `bagiRata`
 * @param adaSupport    apakah ada anggota support yang tercatat membantu
 * @param supervisorJadiPic  PIC-nya adalah Supervisor proyek itu sendiri
 * @param namaInstaller nama Installer Cabang untuk dicatat pada porsinya
 */
export function hitungPembagian(
  sk: SkemaInsentif,
  pool: number,
  remote: boolean,
  penerima: PenerimaPeran[],
  adaSupport: boolean,
  supervisorJadiPic: boolean,
  namaInstaller?: string | null,
  /** Akun PTS Cabang yang dipilih dari dropdown - kosong bila diketik manual. */
  installerUserId?: string | null,
): HasilBagi[] {
  if (pool <= 0) return [];

  // Porsi Installer dipotong dari pool LEBIH DULU; sisanya baru dibagi menurut
  // skema. Dengan begitu total selalu 100% berapa pun porsi Installer diset.
  /*
    Dua jalur, dan yang menentukan hanya satu saklar.

    TURUNAN (porsiRemote.aktif = false, bawaan): porsi dasar dikali sisa pool
    sesudah dipotong Installer. Tidak bisa berjumlah salah karena angkanya
    memang turunan.

    DIATUR SENDIRI (aktif = true): peta Remote dipakai apa adanya, termasuk
    baris 'installer' yang ada di dalamnya. Tidak ada pengalian, dan porsi
    Installer diambil dari peta itu - bukan dari installerRemotePersen -
    supaya yang membayar persis angka yang terbaca di layar.
  */
  let dasar: Record<string, number>;
  let pctInstaller: number;
  let faktor: number;

  /*
    Supervisor merangkap PIC PUNYA TABEL SENDIRI bila diaktifkan.

    Bawaan (saklar mati): porsi koordinasi Supervisor sekadar dipindah ke
    hangusSupervisorKe di atas peta PIC-staff-biasa - itu tidak membedakan
    bahwa Supervisor-sebagai-PIC menanggung DUA peran sekaligus, dan
    besarnya beda lagi antara Remote/Onsite serta ada/tidaknya Support.

    Saklar menyala: peta khusus dipakai APA ADANYA (persis pola porsiRemote),
    termasuk baris 'installer' bila ada di dalamnya - GANTI TOTAL dasar dari
    petaPorsiBerlaku, bukan menambal di atasnya.
  */
  if (supervisorJadiPic && sk.supervisorSebagaiPic?.aktif) {
    const grup = remote ? sk.supervisorSebagaiPic.remote : sk.supervisorSebagaiPic.onsite;
    const peta = { ...(adaSupport ? grup.adaSupport : grup.tanpaSupport) };
    pctInstaller = Math.max(0, Math.min(99, peta.installer || 0));
    delete peta.installer;
    dasar = peta;
    faktor = 1;
  } else {
    const berlaku = petaPorsiBerlaku(sk, remote, adaSupport);
    dasar = berlaku.dasar; pctInstaller = berlaku.pctInstaller; faktor = berlaku.faktor;
    // Perilaku LAMA: porsi koordinasi Supervisor dialihkan, bukan dibayar dua kali.
    if (supervisorJadiPic && dasar.supervisor) {
      const pindah = dasar.supervisor;
      dasar.supervisor = 0;
      const tujuan = sk.hangusSupervisorKe;
      if (tujuan) dasar[tujuan] = (dasar[tujuan] || 0) + pindah;
    }
  }

  const bagiRata = new Map(sk.porsi.map(p => [p.peran, p.bagiRata]));
  const hasil: HasilBagi[] = [];

  for (const [peran, persenPenuh] of Object.entries(dasar)) {
    const persen = (persenPenuh || 0) * faktor;
    if (persen <= 0) continue;
    const orang = penerima.filter(p => p.peran === peran);
    if (!orang.length) continue;
    const bagi = bagiRata.get(peran) !== false && orang.length > 1;
    const n = bagi ? orang.length : 1;
    for (const o of (bagi ? orang : orang.slice(0, 1))) {
      //  amount diisi belakangan oleh bagikanTepat - lihat catatan di sana.
      hasil.push({ role: peran, user_id: o.user_id, user_name: o.user_name, percentage: persen / n, amount: 0 });
    }
  }

  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer',
      user_id: installerUserId || '',
      user_name: namaInstaller || 'PTS Daerah',
      percentage: pctInstaller,
      amount: 0,
    });
  }

  const rupiah = bagikanTepat(pool, hasil.map(h => h.percentage));
  return hasil.map((h, i) => ({ ...h, amount: rupiah[i] }));
}

/** Pembagian saat Manager sendiri yang menjadi PIC. */
export function hitungManagerSebagaiPic(
  sk: SkemaInsentif,
  pool: number,
  remote: boolean,
  managerId: string,
  managerNama: string,
  namaInstaller?: string | null,
  /**
   * Orang yang menangani Troubleshooting pada tahun pencairan ini.
   *
   * Dulu tidak ada parameter ini sama sekali, jadi Manager-sebagai-PIC selalu
   * menerima seluruh pool - termasuk pada tahun ke-2 dan ke-3 ketika timnya
   * yang mengerjakan Troubleshooting-nya. Pada proyek biasa orang yang sama
   * mendapat porsi Support; pada proyek Manager mereka tidak. Perlakuan yang
   * berbeda untuk pekerjaan yang sama persis.
   */
  penerimaSupport: PenerimaPeran[] = [],
  /** Akun PTS Cabang yang dipilih dari dropdown - kosong bila diketik manual. */
  installerUserId?: string | null,
): HasilBagi[] {
  if (pool <= 0) return [];
  const pctInstaller = persenInstaller(sk, remote);
  const faktor = (100 - pctInstaller) / 100;

  const adaSupport = penerimaSupport.length > 0;
  const peta = adaSupport ? sk.managerSebagaiPic.adaSupport : sk.managerSebagaiPic.tanpaSupport;

  const hasil: HasilBagi[] = [];
  for (const [peran, p] of Object.entries(peta)) {
    const persen = (p || 0) * faktor;
    if (persen <= 0) continue;
    if (peran === 'support') {
      //  Porsi Support dibagi rata ke semua yang menangani tahun itu - sama
      //  seperti skema standar, supaya tidak ada dua aturan untuk satu hal.
      for (const o of penerimaSupport) {
        hasil.push({ role: 'support', user_id: o.user_id, user_name: o.user_name,
          percentage: persen / penerimaSupport.length, amount: 0 });
      }
      continue;
    }
    hasil.push({ role: peran, user_id: managerId, user_name: managerNama, percentage: persen, amount: 0 });
  }
  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer', user_id: installerUserId || '',
      user_name: namaInstaller || 'PTS Daerah',
      percentage: pctInstaller, amount: 0,
    });
  }
  const rupiah = bagikanTepat(pool, hasil.map(h => h.percentage));
  return hasil.map((h, i) => ({ ...h, amount: rupiah[i] }));
}
