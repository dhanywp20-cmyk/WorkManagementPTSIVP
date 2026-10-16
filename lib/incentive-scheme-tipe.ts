/** incentive-scheme-tipe.ts - dipecah dari incentive-scheme.ts (scripts/pecah-modul.mjs); incentive-scheme.ts tetap mengekspor ulang semuanya. */

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

  /**
   * Kategori Request Schedule yang dihitung sebagai proyek insentif.
   *
   * Dulu dipaku di kode (INCENTIVE_CATEGORIES). Sekarang data, karena tiap
   * perusahaan menamai layanannya sendiri - dan menambah satu nama tidak
   * boleh berarti mengubah kode lalu deploy ulang.
   *
   * Namanya harus PERSIS sama dengan yang dipakai di Request Schedule; itu
   * yang dicocokkan saat menarik daftar proyek.
   */
  kategoriProyek: string[];

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

  /**
   * Pembagian KHUSUS saat Supervisor sendiri yang merangkap PIC proyeknya.
   *
   * Bawaan LAMA (saklar mati): porsi koordinasi Supervisor sekadar dipindah
   * ke `hangusSupervisorKe` di atas peta PIC-staff-biasa (sk.porsi/
   * tanpaSupport) - itu tidak membedakan bahwa Supervisor-sebagai-PIC
   * menanggung DUA peran sekaligus, dan besarnya beban itu beda lagi antara
   * Remote/Onsite serta ada/tidaknya Support. Proposal tidak pernah
   * membedakan ini.
   *
   * Saklar `aktif: true` mengambil alih SEPENUHNYA - dipakai apa adanya,
   * termasuk baris 'installer' bila ada (persis pola porsiRemote). Baris
   * lama yang belum punya kolom ini otomatis dapat `aktif: false`, jadi
   * perilakunya SAMA PERSIS seperti sebelum kolom ini ada - tidak ada proyek
   * yang mendadak dibayar beda karena penambahan fitur.
   */
  supervisorSebagaiPic: {
    aktif: boolean;
    /** Proyek mode Remote. WAJIB memuat baris 'installer' bila diaktifkan, total 100. */
    remote: { adaSupport: Record<string, number>; tanpaSupport: Record<string, number> };
    /** Proyek mode Onsite. Total 100 (biasanya tanpa Installer). */
    onsite: { adaSupport: Record<string, number>; tanpaSupport: Record<string, number> };
  };
}
