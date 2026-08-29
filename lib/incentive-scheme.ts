import { supabase } from './supabase';

/**
 * Kategori Request Schedule yang menghasilkan proyek insentif.
 *
 * Tinggal di sini, bukan di modul Incentive, karena Request Schedule juga
 * membutuhkannya - untuk tombol "Sync ke Incentive". Menaruhnya di modul
 * Incentive akan memaksa halaman jadwal menarik seluruh mesin hitung insentif
 * hanya demi sebuah daftar tiga kata.
 */
export const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;


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

  /**
   * Pembagian saat Manager sendiri yang menjadi PIC.
   *
   * DUA keadaan, sama seperti skema standar - dan ini yang dulu tidak ada.
   * Bentuk lamanya satu peta saja ({ pic: 100 }), jadi Manager selalu menerima
   * seluruh pool APA PUN yang terjadi sesudahnya. Padahal proyek yang
   * ditangani Manager tetap butuh Troubleshooting di tahun-tahun berikutnya,
   * dan orang yang mengerjakannya tidak mendapat apa-apa - sementara pada
   * proyek biasa mereka dapat. Dua perlakuan berbeda untuk pekerjaan yang
   * sama persis.
   *
   * Sekarang tahun yang ADA Troubleshooting-nya memakai `adaSupport`, dan
   * tahun yang tidak ada memakai `tanpaSupport`. Keduanya harus berjumlah 100.
   */
  managerSebagaiPic: {
    /** Ada Support di tahun itu, mis. { pic: 85, support: 15 }. */
    adaSupport: Record<string, number>;
    /** Tidak ada Support di tahun itu, mis. { pic: 100 }. */
    tanpaSupport: Record<string, number>;
  };

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

  /**
   * Porsi khusus mode REMOTE, diatur sendiri - bukan diturunkan.
   *
   * Bawaannya `aktif: false`, dan saat itu porsi Remote dihitung otomatis:
   * porsi dasar dikali sisa pool sesudah dipotong Installer (mis. 65% x 85%
   * = 55,25%). Itu perilaku yang sesuai proposal dan tidak bisa berjumlah
   * salah, karena angkanya turunan.
   *
   * `aktif: true` mengambil alih sepenuhnya: yang dipakai angka di bawah,
   * apa adanya. Berguna kalau kelak kebijakan Remote tidak lagi sekadar
   * "porsi normal dikali sisa" - mis. Supervisor dapat porsi lebih besar
   * saat Remote karena beban koordinasinya bertambah.
   *
   * KEDUA peta HARUS memuat baris `installer` dan berjumlah tepat 100.
   * Installer ikut di dalam tabel - bukan dipotong lebih dulu - supaya yang
   * dibaca admin adalah pembagian utuh satu layar, bukan angka yang masih
   * harus dikalikan sendiri di kepala.
   */
  porsiRemote: {
    aktif: boolean;
    /** Ada Support PTS di tahun itu. Termasuk 'installer'. Total 100. */
    adaSupport: Record<string, number>;
    /** Tidak ada Support PTS di tahun itu. Termasuk 'installer'. Total 100. */
    tanpaSupport: Record<string, number>;
  };

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
  //  Bawaan: sama-sama 100% ke Manager, PERSIS seperti perilaku lama - supaya
  //  memasang perubahan ini tidak mengubah pembayaran siapa pun sampai admin
  //  memang memutuskan memberi porsi Support.
  managerSebagaiPic: { adaSupport: { pic: 100 }, tanpaSupport: { pic: 100 } },
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
  //  Angkanya = turunan proposal (65/15/10/10 x 85% + Installer 15). Diisi
  //  supaya saat saklarnya dinyalakan admin tidak mulai dari nol, melainkan
  //  dari keadaan yang persis sama dengan yang sedang berlaku.
  porsiRemote: {
    aktif: false,
    adaSupport:   { pic: 55.25, support: 12.75, supervisor: 8.5, manager: 8.5, installer: 15 },
    tanpaSupport: { pic: 68,    supervisor: 8.5, manager: 8.5,   installer: 15 },
  },
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

/**
 * Bagi `pool` rupiah menurut daftar persentase, HABIS TANPA SISA.
 *
 * KENAPA BUKAN Math.round() PER ORANG
 *
 * Membulatkan tiap bagian sendiri-sendiri membuat jumlahnya meleset dari pool.
 * Itu bukan kekhawatiran teoretis: disimulasikan pada 144.000 tranche dengan
 * pool "kotor" hasil 1% dari HPP, HAMPIR SETENGAHNYA (49,9%) meleset lebih
 * dari Rp 1 - selisih terbesar Rp 6,30. Karena processYearlyBatch menolak
 * tranche yang melesetnya > Rp 1, separuh pencairan akan gagal diproses dan
 * timnya tidak dibayar, dengan pesan galat yang menyesatkan ("split total
 * mismatch") karena angkanya sendiri sebenarnya benar.
 *
 * Cara yang dipakai di sini metode sisa terbesar (largest remainder), yang
 * juga dipakai pembagian kursi pemilu: semua dibulatkan ke BAWAH dulu, lalu
 * rupiah sisanya dibagikan satu per satu ke yang pecahannya paling besar.
 * Hasilnya dijamin persis sama dengan pool - bukan "cukup dekat".
 *
 * Rupiah sisa diberikan ke pecahan terbesar, BUKAN ke porsi terbesar. Kalau
 * ke porsi terbesar, PIC akan selalu mendapat kelebihan itu di setiap proyek
 * selamanya; dengan pecahan terbesar, yang menerima berganti-ganti mengikuti
 * angkanya sendiri - dan selisihnya memang hanya satu rupiah.
 */
export function bagikanTepat(pool: number, persenTiap: number[]): number[] {
  const target = Math.round(pool);
  if (!persenTiap.length || target <= 0) return persenTiap.map(() => 0);

  const tepat = persenTiap.map(p => (target * p) / 100);
  const bawah = tepat.map(v => Math.floor(v));
  let sisa = target - bawah.reduce((a, b) => a + b, 0);

  //  Bila daftar persennya tidak berjumlah 100 (mis. satu peran tidak punya
  //  penerima), sisanya bisa jauh lebih besar dari jumlah orang. Yang dibagikan
  //  hanya selisih pembulatan, jadi dibatasi sebanyak penerimanya saja.
  const urut = tepat
    .map((v, i) => ({ i, pecahan: v - Math.floor(v) }))
    .sort((a, b) => b.pecahan - a.pecahan);

  for (let k = 0; k < urut.length && sisa > 0; k++, sisa--) bawah[urut[k].i] += 1;
  return bawah;
}

// Pemeriksaan

export interface MasalahSkema {
  bidang: string;
  pesan: string;
  /**
   * true = tidak menghalangi penyimpanan. Dipakai untuk hal yang perhitungannya
   * tetap benar tapi berpotensi menyimpang dari dokumen kebijakan - keputusan
   * mana yang benar ada di manusia, bukan di validasi.
   */
  peringatan?: boolean;
}

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

  for (const [nama, peta] of [
    ['ada support', sk.managerSebagaiPic.adaSupport],
    ['tanpa support', sk.managerSebagaiPic.tanpaSupport],
  ] as const) {
    const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
    if (total !== 100) {
      masalah.push({ bidang: 'managerSebagaiPic', pesan: `Manager-sebagai-PIC (${nama}) ${total}% — harus tepat 100%.` });
    }
  }

  if (sk.installerRemotePersen < 0 || sk.installerRemotePersen >= 100) {
    masalah.push({ bidang: 'installer', pesan: 'Porsi Installer harus 0–99%.' });
  }
  /*
    Peta Remote yang diatur sendiri ikut wajib 100% - dan wajib SENDIRI-SENDIRI,
    bukan gabungan. Kalau hanya totalnya yang diperiksa, satu peta boleh 110%
    asal yang lain 90%, dan yang salah cuma muncul pada proyek yang kebetulan
    memakai peta itu.
  */
  if (sk.porsiRemote?.aktif) {
    for (const [nama, peta] of [
      ['ada support', sk.porsiRemote.adaSupport],
      ['tanpa support', sk.porsiRemote.tanpaSupport],
    ] as const) {
      const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
      if (total !== 100) {
        masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}) ${total}% — harus tepat 100%.` });
      }
      for (const k of Object.keys(peta ?? {})) {
        if (k !== 'installer' && !kunci.includes(k)) {
          masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}): peran "${k}" tidak ada di daftar porsi.` });
        }
      }
    }
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

  /*
    TIDAK ADA LAGI syarat "porsi Installer harus sama dengan tahap terakhir".

    Peringatan itu ada selama Installer dibayar dengan cara mengambil alih
    tahap terakhir. Cara itu sudah diganti: porsi Installer kini dititipkan
    sebagai baris tambahan di tahap PERTAMA, dan seluruh tahapan tetap milik
    Tim PTS. Jadi porsi Installer boleh berapa pun tanpa mengganggu jadwal
    pencairan siapa pun, dan tidak ada lagi yang perlu disamakan.
  */

  return masalah;
}

// Baca / simpan

/**
 * Baca managerSebagaiPic dari bentuk LAMA maupun BARU.
 *
 * Bentuk lama = satu peta datar ({ pic: 100 }). Bentuk baru = dua keadaan.
 * Baris lama disalin ke KEDUA keadaan, jadi perilakunya persis sama seperti
 * sebelumnya - tidak ada proyek yang mendadak dibayar berbeda karena
 * strukturnya berubah. Admin yang memutuskan kapan keduanya dibedakan.
 */
function bacaManagerPic(raw: unknown): SkemaInsentif['managerSebagaiPic'] {
  const r = raw as Partial<SkemaInsentif['managerSebagaiPic']> & Record<string, unknown>;
  if (r && typeof r === 'object' && ('adaSupport' in r || 'tanpaSupport' in r)) {
    return {
      adaSupport: (r.adaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.adaSupport,
      tanpaSupport: (r.tanpaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.tanpaSupport,
    };
  }
  const datar = (r as Record<string, number> | null | undefined);
  if (datar && Object.keys(datar).length) return { adaSupport: { ...datar }, tanpaSupport: { ...datar } };
  return SKEMA_BAWAAN.managerSebagaiPic;
}

/** Gabungkan hasil baca dengan bawaan supaya kolom baru tidak bernilai undefined. */
function rapikan(raw: unknown): SkemaInsentif {
  const r = (raw ?? {}) as Partial<SkemaInsentif>;
  return {
    versi: r.versi ?? SKEMA_BAWAAN.versi,
    porsi: Array.isArray(r.porsi) && r.porsi.length ? r.porsi : SKEMA_BAWAAN.porsi,
    tanpaSupport: r.tanpaSupport ?? SKEMA_BAWAAN.tanpaSupport,
    jendelaSupportBulan: r.jendelaSupportBulan ?? SKEMA_BAWAAN.jendelaSupportBulan,
    hangusSupervisorKe: r.hangusSupervisorKe ?? SKEMA_BAWAAN.hangusSupervisorKe,
    managerSebagaiPic: bacaManagerPic(r.managerSebagaiPic),
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
    //  Skema lama tidak punya kolom ini. Jatuh ke bawaan yang saklarnya MATI,
    //  jadi perilakunya persis seperti sebelumnya - tidak ada proyek yang
    //  mendadak dibayar dengan angka lain karena penambahan kolom.
    porsiRemote: r.porsiRemote ?? SKEMA_BAWAAN.porsiRemote,
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

/**
 * Simpan skema sebagai VERSI BARU - baris lama tidak ditimpa.
 *
 * Dulu fungsi ini melakukan UPDATE pada satu-satunya baris pengaturan, jadi
 * angka sebelumnya lenyap begitu disimpan. Untuk pengaturan tampilan itu tidak
 * masalah; untuk aturan pembagian uang itu menghapus bukti. Sebuah proyek
 * dihitung tiga kali dalam tiga tahun, dan tanpa baris lamanya tidak ada cara
 * menjelaskan kenapa tahap 1 berbeda dari tahap 2.
 *
 * ambilSkema() sudah mengambil baris TERBARU, jadi menambah baris tidak
 * mengubah apa pun soal skema mana yang berlaku - hanya menyimpan jejaknya.
 */
export async function simpanSkema(sk: SkemaInsentif, olehNama: string): Promise<{ error: string | null }> {
  //  Peringatan tidak menahan penyimpanan - hanya galat sungguhan yang menahan.
  const galat = periksaSkema(sk).filter(m => !m.peringatan);
  if (galat.length) return { error: galat.map(m => m.pesan).join(' ') };
  const { error } = await supabase.from('incentive_scheme_settings').insert({
    scheme: sk as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
    updated_by: olehNama,
  });
  return { error: error?.message ?? null };
}

export interface VersiSkema {
  id: string;
  scheme: SkemaInsentif;
  updated_at: string;
  updated_by: string | null;
}

/** Riwayat perubahan skema, terbaru dulu. */
export async function riwayatSkema(batas = 20): Promise<VersiSkema[]> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('id, scheme, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(batas);
    return ((data ?? []) as { id: string; scheme: unknown; updated_at: string; updated_by: string | null }[])
      .map(r => ({ id: r.id, scheme: rapikan(r.scheme), updated_at: r.updated_at, updated_by: r.updated_by }));
  } catch {
    return [];
  }
}

/**
 * Penanda skema untuk dicetak di rekap ke Finance.
 *
 * Tanpa ini, rekap hanya berisi nominal - dan setahun kemudian tidak ada yang
 * bisa memastikan angka itu dihitung dengan aturan yang mana.
 */
export function labelSkema(sk: SkemaInsentif, tanggal?: string, oleh?: string | null): string {
  const porsi = sk.porsi.map(p => `${p.peran}${p.persen}`).join('/');
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  return [`Skema v${sk.versi}`, porsi, tgl, oleh].filter(Boolean).join(' · ');
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
  const { dasar, pctInstaller, faktor } = petaPorsiBerlaku(sk, remote, adaSupport);

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
      //  amount diisi belakangan oleh bagikanTepat - lihat catatan di sana.
      hasil.push({ role: peran, user_id: o.user_id, user_name: o.user_name, percentage: persen / n, amount: 0 });
    }
  }

  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer',
      user_id: '',
      user_name: namaInstaller || 'Installer Cabang',
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
      role: 'installer', user_id: '',
      user_name: namaInstaller || 'Installer Cabang',
      percentage: pctInstaller, amount: 0,
    });
  }
  const rupiah = bagikanTepat(pool, hasil.map(h => h.percentage));
  return hasil.map((h, i) => ({ ...h, amount: rupiah[i] }));
}
