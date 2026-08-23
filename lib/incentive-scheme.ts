import { supabase } from './supabase';

/**
 * Skema pembagian insentif project - DATA, bukan kode.
 *
 * Seluruh angka porsi disimpan sebagai satu baris JSON di tabel
 * incentive_scheme_settings dan disunting dari layar Pengaturan. Menambah
 * peran baru - mis. Installer Cabang kembali diberi porsi - cukup menambah
 * satu baris di layar itu; tidak ada rumus di kode yang perlu disentuh, jadi
 * tidak ada tempat yang bisa ketinggalan saat kebijakan berubah.
 */

/** Peran yang dikenal bawaan. Peran baru boleh memakai kunci apa pun. */
export type PeranInti = 'pic' | 'support' | 'supervisor' | 'manager' | 'installer';

export interface PorsiPeran {
  /** Kunci peran, dipakai sebagai `role` pada tabel incentive_splits. */
  peran: string;
  /** Nama yang tampil di layar dan di rekap. */
  label: string;
  /** Persentase dari pool insentif proyek. */
  persen: number;
  /**
   * true = porsi ini dibagi rata ke SEMUA orang yang memenuhi peran tersebut
   * (mis. beberapa anggota support), bukan diberikan ke satu orang.
   */
  bagiRata: boolean;
}

export interface TahapPencairan {
  nomor: number;
  persen: number;
  /** Dicairkan pada tahun BAST + nilai ini. */
  tahunKe: number;
}

export interface SkemaInsentif {
  /** Dinaikkan tiap kali struktur skema berubah, untuk keperluan migrasi. */
  versi: number;

  /** Pembagian normal - harus berjumlah 100. */
  porsi: PorsiPeran[];

  /**
   * Pembagian pengganti bila TIDAK ADA anggota support yang membantu dalam
   * jendela penilaian. Peta peran  persen; peran yang tidak disebut mendapat 0.
   * Harus berjumlah 100 juga.
   */
  tanpaSupport: Record<string, number>;

  /**
   * Lama penilaian keaktifan support, dihitung sejak BAST. Menentukan kapan
   * sebuah proyek dianggap "tanpa support".
   */
  jendelaSupportBulan: number;

  /**
   * Bila orang yang menjadi PIC ternyata juga Supervisor proyek itu, porsi
   * koordinasinya tidak boleh dobel - dialihkan ke peran ini.
   * Kosongkan untuk membiarkan porsinya hangus tanpa penerima.
   */
  hangusSupervisorKe: string;

  /** Pembagian saat Manager sendiri yang menjadi PIC. Peta peran  persen. */
  managerSebagaiPic: Record<string, number>;

  /**
   * Installer ikut mendapat pembagian atau tidak.
   *
   * Saklar TERSENDIRI, bukan sekadar "persennya 0". Keduanya memang berakibat
   * sama pada hitungan, tapi maknanya berbeda dan itu terbaca di layar:
   * porsi 0 dengan saklar menyala berarti "Installer ikut, angkanya belum
   * diisi" - keadaan yang keliru dan diberitahukan periksaSkema. Tanpa
   * saklarnya, kekeliruan itu tidak bisa dibedakan dari kebijakan yang memang
   * meniadakan porsi Installer.
   *
   * Nama & daerah Installer TETAP dicatat dari Request Schedule apa pun nilai
   * ini - pencatatan rekam jejak tidak bergantung pada pembagian uang.
   */
  installerAktif: boolean;

  /**
   * Porsi Installer dalam persen dari pool. Porsinya dipotong dari pool LEBIH
   * DULU, sisanya baru dibagi menurut skema - jadi total selalu 100 berapa pun
   * angka ini.
   */
  installerRemotePersen: number;

  /**
   * Porsi Installer hanya berlaku pada proyek mode REMOTE.
   *
   * true = perilaku yang berjalan selama ini. false = Installer mendapat
   * porsinya pada proyek mana pun. Dijadikan pilihan, bukan dipaku, karena
   * "remote saja" adalah kebijakan - dan kebijakan yang dipaku di kode
   * berarti harus deploy ulang setiap kali atasan mengubahnya.
   */
  installerHanyaRemote: boolean;

  /**
   * Installer dibayar PENUH di tahun pertama, tidak ikut dibagi ke tahapan
   * pencairan bertahun-tahun seperti Tim PTS.
   */
  installerBayarDiMuka: boolean;

  /** Tahapan pencairan untuk Tim PTS. Harus berjumlah 100. */
  tranche: TahapPencairan[];
}

/**
 * Nilai bawaan = angka pada Proposal Insentif PTS IVP & MVI 2026.
 *
 * Sebelumnya bawaan di sini (50/20/15/15) TIDAK sama dengan proposal
 * (65/15/10/10) - dua sumber kebenaran untuk satu kebijakan. Disamakan supaya
 * tombol "Kembalikan ke bawaan" berarti "kembali ke angka proposal", bukan
 * ke angka yang tidak pernah disetujui siapa pun.
 *
 * CATATAN PENTING: baris yang SUDAH tersimpan di incentive_scheme_settings
 * menang atas nilai di sini. Mengubah berkas ini TIDAK mengubah perhitungan
 * yang sedang berjalan - itu harus dilakukan dari layar Skema Pembagian.
 * Disengaja: kebijakan uang tidak boleh berubah diam-diam karena deploy.
 */
export const SKEMA_BAWAAN: SkemaInsentif = {
  versi: 3,
  porsi: [
    { peran: 'pic',        label: 'PIC Proyek',                   persen: 65, bagiRata: true  },
    { peran: 'support',    label: 'Tim Support (Troubleshooting)', persen: 15, bagiRata: true  },
    { peran: 'supervisor', label: 'Supervisor',                   persen: 10, bagiRata: true  },
    { peran: 'manager',    label: 'Manager',                      persen: 10, bagiRata: false },
  ],
  //  Proposal: porsi Support diserap PIC -> PIC 80, Supervisor 10, Manager 10.
  tanpaSupport: { pic: 80, supervisor: 10, manager: 10 },
  jendelaSupportBulan: 12,
  hangusSupervisorKe: 'manager',
  managerSebagaiPic: { pic: 100 },
  //  Proposal Bagian B: Installer daerah 15%, HANYA mode Remote, dibayar
  //  penuh di tahun pertama (mengambil porsi Tahap 3).
  installerAktif: true,
  installerRemotePersen: 15,
  installerHanyaRemote: true,
  installerBayarDiMuka: true,
  tranche: [
    { nomor: 1, persen: 50, tahunKe: 1 },
    { nomor: 2, persen: 35, tahunKe: 2 },
    { nomor: 3, persen: 15, tahunKe: 3 },
  ],
};

/**
 * Porsi Installer yang BERLAKU untuk sebuah proyek, sesudah saklar & lingkupnya
 * diterapkan. Satu-satunya tempat aturan ini ditulis.
 *
 * Sebelumnya ungkapan `remote ? Math.max(0, Math.min(99, sk.installerRemotePersen)) : 0`
 * tersalin di empat berkas - hitungPembagian, hitungManagerSebagaiPic,
 * generateTranches, dan halaman Incentive PTS. Menambah saklar aktif/nonaktif
 * ke bentuk seperti itu berarti empat kesempatan untuk melewatkan satu, dan
 * yang terlewat tidak akan gagal terang-terangan: ia cuma membayar Installer
 * di satu layar dan tidak di layar lain.
 */
export function persenInstaller(sk: SkemaInsentif, remote: boolean): number {
  if (!sk.installerAktif) return 0;
  if (sk.installerHanyaRemote && !remote) return 0;
  //  Dibatasi 0-99, bukan 0-100: porsi 100% menyisakan 0 untuk seluruh Tim
  //  PTS, dan itu hampir pasti salah ketik, bukan kebijakan.
  return Math.max(0, Math.min(99, sk.installerRemotePersen || 0));
}

// Pemeriksaan

export interface MasalahSkema { bidang: string; pesan: string }

/**
 * Periksa skema sebelum disimpan.
 *
 * Skema yang totalnya bukan 100 tidak ditolak diam-diam di kemudian hari - ia
 * akan lolos sampai batch pencairan berjalan, lalu seluruh proyek tahun itu
 * gagal diproses sekaligus. Karena itu pemeriksaannya dilakukan di depan.
 */
export function periksaSkema(sk: SkemaInsentif): MasalahSkema[] {
  const masalah: MasalahSkema[] = [];
  const bulat = (n: number) => Math.round(n * 100) / 100;

  const totalPorsi = bulat(sk.porsi.reduce((t, p) => t + (p.persen || 0), 0));
  if (totalPorsi !== 100) masalah.push({ bidang: 'porsi', pesan: `Total porsi ${totalPorsi}% — harus tepat 100%.` });

  const kunci = sk.porsi.map(p => p.peran.trim().toLowerCase());
  if (new Set(kunci).size !== kunci.length) masalah.push({ bidang: 'porsi', pesan: 'Ada kunci peran yang kembar.' });
  if (kunci.some(k => !k)) masalah.push({ bidang: 'porsi', pesan: 'Ada peran tanpa kunci.' });
  if (!kunci.includes('pic')) masalah.push({ bidang: 'porsi', pesan: 'Peran "pic" wajib ada — ia penerima utama.' });

  const totalTanpa = bulat(Object.values(sk.tanpaSupport).reduce((t, n) => t + (n || 0), 0));
  if (totalTanpa !== 100) masalah.push({ bidang: 'tanpaSupport', pesan: `Total porsi tanpa support ${totalTanpa}% — harus tepat 100%.` });
  for (const k of Object.keys(sk.tanpaSupport)) {
    if (!kunci.includes(k)) masalah.push({ bidang: 'tanpaSupport', pesan: `Peran "${k}" tidak ada di daftar porsi.` });
  }

  const totalMgr = bulat(Object.values(sk.managerSebagaiPic).reduce((t, n) => t + (n || 0), 0));
  if (totalMgr !== 100) masalah.push({ bidang: 'managerSebagaiPic', pesan: `Total skema Manager-sebagai-PIC ${totalMgr}% — harus tepat 100%.` });

  if (sk.installerRemotePersen < 0 || sk.installerRemotePersen >= 100) {
    masalah.push({ bidang: 'installer', pesan: 'Porsi Installer harus 0–99%.' });
  }
  //  Saklar menyala tapi porsinya 0 adalah setengah jalan: layarnya berkata
  //  "Installer ikut", hitungannya memberi nol. Salah satunya harus dibetulkan
  //  sebelum disimpan, dan mana yang dimaksud hanya orangnya yang tahu.
  if (sk.installerAktif && (sk.installerRemotePersen || 0) <= 0) {
    masalah.push({
      bidang: 'installer',
      pesan: 'Installer dinyalakan tapi porsinya 0% — isi porsinya, atau matikan saklarnya.',
    });
  }
  if (sk.jendelaSupportBulan < 0) masalah.push({ bidang: 'jendela', pesan: 'Jendela penilaian support tidak boleh negatif.' });

  const totalTranche = bulat(sk.tranche.reduce((t, x) => t + (x.persen || 0), 0));
  if (totalTranche !== 100) masalah.push({ bidang: 'tranche', pesan: `Total tahapan pencairan ${totalTranche}% — harus tepat 100%.` });
  if (!sk.tranche.length) masalah.push({ bidang: 'tranche', pesan: 'Minimal ada satu tahapan pencairan.' });

  return masalah;
}

// Baca / simpan

/** Gabungkan hasil baca dengan bawaan supaya kolom baru tidak bernilai undefined. */
function rapikan(raw: unknown): SkemaInsentif {
  const r = (raw ?? {}) as Partial<SkemaInsentif>;
  return {
    versi: r.versi ?? SKEMA_BAWAAN.versi,
    porsi: Array.isArray(r.porsi) && r.porsi.length ? r.porsi : SKEMA_BAWAAN.porsi,
    tanpaSupport: r.tanpaSupport ?? SKEMA_BAWAAN.tanpaSupport,
    jendelaSupportBulan: r.jendelaSupportBulan ?? SKEMA_BAWAAN.jendelaSupportBulan,
    hangusSupervisorKe: r.hangusSupervisorKe ?? SKEMA_BAWAAN.hangusSupervisorKe,
    managerSebagaiPic: r.managerSebagaiPic ?? SKEMA_BAWAAN.managerSebagaiPic,
    //  Skema yang tersimpan SEBELUM saklar ini ada tidak punya installerAktif.
    //  Jatuhnya TIDAK boleh ke bawaan (false): baris lama yang porsinya sudah
    //  diisi > 0 akan diam-diam berhenti membayar Installer pada perhitungan
    //  berikutnya, dan tidak ada yang tahu sampai seseorang memeriksa rekap.
    //  Jadi keaktifannya disimpulkan dari porsinya - itu memang satu-satunya
    //  penanda yang tersedia di baris lama.
    installerAktif: r.installerAktif ?? (r.installerRemotePersen ?? 0) > 0,
    installerRemotePersen: r.installerRemotePersen ?? SKEMA_BAWAAN.installerRemotePersen,
    installerHanyaRemote: r.installerHanyaRemote ?? SKEMA_BAWAAN.installerHanyaRemote,
    installerBayarDiMuka: r.installerBayarDiMuka ?? SKEMA_BAWAAN.installerBayarDiMuka,
    tranche: Array.isArray(r.tranche) && r.tranche.length ? r.tranche : SKEMA_BAWAAN.tranche,
  };
}

/**
 * Ambil skema yang berlaku.
 *
 * Bila tabelnya belum dibuat (migrasi belum dijalankan) atau barisnya belum
 * ada, kembalikan bawaan - perhitungan tetap jalan dengan kebijakan terkini,
 * bukan gagal total.
 */
export async function ambilSkema(): Promise<SkemaInsentif> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('scheme')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return rapikan((data as { scheme?: unknown } | null)?.scheme);
  } catch {
    return SKEMA_BAWAAN;
  }
}

export async function simpanSkema(sk: SkemaInsentif, olehNama: string): Promise<{ error: string | null }> {
  const masalah = periksaSkema(sk);
  if (masalah.length) return { error: masalah.map(m => m.pesan).join(' ') };
  const { data } = await supabase.from('incentive_scheme_settings').select('id').limit(1).maybeSingle();
  const baris = { scheme: sk as unknown as Record<string, unknown>, updated_at: new Date().toISOString(), updated_by: olehNama };
  const res = (data as { id?: string } | null)?.id
    ? await supabase.from('incentive_scheme_settings').update(baris).eq('id', (data as { id: string }).id)
    : await supabase.from('incentive_scheme_settings').insert(baris);
  return { error: res.error?.message ?? null };
}

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
): HasilBagi[] {
  if (pool <= 0) return [];

  // Porsi Installer dipotong dari pool LEBIH DULU; sisanya baru dibagi menurut
  // skema. Dengan begitu total selalu 100% berapa pun porsi Installer diset.
  const pctInstaller = persenInstaller(sk, remote);
  const faktor = (100 - pctInstaller) / 100;

  const dasar: Record<string, number> = adaSupport
    ? Object.fromEntries(sk.porsi.map(p => [p.peran, p.persen]))
    : { ...sk.tanpaSupport };

  // Supervisor merangkap PIC: porsi koordinasinya dialihkan, bukan dibayar dua kali.
  if (supervisorJadiPic && dasar.supervisor) {
    const pindah = dasar.supervisor;
    dasar.supervisor = 0;
    const tujuan = sk.hangusSupervisorKe;
    if (tujuan) dasar[tujuan] = (dasar[tujuan] || 0) + pindah;
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
      hasil.push({
        role: peran,
        user_id: o.user_id,
        user_name: o.user_name,
        percentage: persen / n,
        amount: Math.round((pool * persen) / 100 / n),
      });
    }
  }

  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer',
      user_id: '',
      user_name: namaInstaller || 'Installer Cabang',
      percentage: pctInstaller,
      amount: Math.round((pool * pctInstaller) / 100),
    });
  }

  return hasil;
}

/** Pembagian saat Manager sendiri yang menjadi PIC. */
export function hitungManagerSebagaiPic(
  sk: SkemaInsentif,
  pool: number,
  remote: boolean,
  managerId: string,
  managerNama: string,
  namaInstaller?: string | null,
): HasilBagi[] {
  if (pool <= 0) return [];
  const pctInstaller = persenInstaller(sk, remote);
  const faktor = (100 - pctInstaller) / 100;
  const hasil: HasilBagi[] = Object.entries(sk.managerSebagaiPic)
    .filter(([, p]) => (p || 0) > 0)
    .map(([peran, p]) => ({
      role: peran,
      user_id: managerId,
      user_name: managerNama,
      percentage: (p || 0) * faktor,
      amount: Math.round((pool * (p || 0) * faktor) / 100),
    }));
  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer', user_id: '',
      user_name: namaInstaller || 'Installer Cabang',
      percentage: pctInstaller, amount: Math.round((pool * pctInstaller) / 100),
    });
  }
  return hasil;
}
