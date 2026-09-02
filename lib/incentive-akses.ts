/**
 * lib/incentive-akses.ts - siapa boleh apa di modul Incentive PTS.
 *
 * Sebelumnya jawabannya ditulis di dalam halaman:
 *
 *     function isAdmin(u) { return u.role === 'admin' || u.role === 'superadmin'; }
 *
 * dan seluruh tab konfigurasi (Skema Pembagian, Pengaturan Akses) digantung
 * pada fungsi itu. Akibatnya Manager PTS - pimpinan modul ini - hanya melihat
 * tab "Projects": untuk membukanya harus mengubah kode lalu deploy ulang.
 * Pada platform yang dijual ke perusahaan lain itu tidak bisa dipakai, karena
 * tiap perusahaan menamai jabatan pimpinannya sendiri.
 *
 * Sekarang tingkat aksesnya DATA - satu kolom `users.incentive_akses` yang
 * diatur dari layar "Pengaturan Akses". Berkas ini hanya membacanya, dan
 * sengaja MURNI (tidak menyentuh Supabase) supaya aturan yang sama dipakai
 * dua sisi: layar di peramban dan route server yang memverifikasi ulang.
 * Basis data memakai aturan yang sama lewat fungsi akses_insentif()
 * (sql/incentive-akses-konfigurasi.sql), jadi ketiganya tidak bisa berbeda
 * pendapat.
 */

/**
 * penuh - seluruh konfigurasi: Skema Pembagian, Pengaturan Akses, Process
 *         Batch, set brand, hapus tahapan. Setara admin.
 * input - boleh mengisi nominal & mengelola tahapan, TIDAK boleh mengubah
 *         skema pembagian maupun akses orang lain.
 * lihat - hanya melihat proyek yang ia terlibat di dalamnya dan bagiannya
 *         sendiri. Ini bawaan untuk semua orang.
 */
export type TingkatAkses = 'penuh' | 'input' | 'lihat';

export const URUTAN_AKSES: TingkatAkses[] = ['lihat', 'input', 'penuh'];

export const LABEL_AKSES: Record<TingkatAkses, string> = {
  lihat: 'Lihat saja',
  input: 'Input nominal',
  penuh: 'Konfigurasi penuh',
};

export const JELAS_AKSES: Record<TingkatAkses, string> = {
  lihat: 'Hanya melihat proyek yang ia terlibat & bagiannya sendiri.',
  input: 'Boleh isi nominal, buat & proses tahapan pencairan. Tidak boleh mengubah skema pembagian atau akses orang lain.',
  penuh: 'Setara admin di modul ini: skema pembagian, pengaturan akses, process batch, set brand, hapus tahapan.',
};

/** Bentuk minimum yang dibutuhkan - bukan tipe User penuh, supaya bisa dipakai server maupun klien. */
export interface PemilikAkses {
  role?: string | null;
  incentive_akses?: string | null;
  /** Kolom lama. Dibaca sebagai 'input' selama kolom baru belum diisi. */
  allow_incentive_input?: boolean | null;
  /**
   * 'full' | 'guest' - toggle Full Access platform-wide (Kelola Akun),
   * lib/constants.ts hasFullAccess(). SATU-SATUNYA toggle yang sama dipakai
   * Reminder Schedule/Ticketing/Design Project/Project Progress untuk
   * "setara admin, tanpa batasan". Incentive PTS mengikutinya juga - lihat
   * catatan di tingkatAkses().
   */
  access_level?: string | null;
}

/**
 * Peran sistem yang SELALU dapat akses penuh.
 *
 * Ini bukan hardcode kebijakan perusahaan - 'admin' adalah pemilik platform,
 * dan mengunci diri sendiri di luar layar pengaturan akses akan membuat modul
 * ini tidak bisa dipulihkan tanpa SQL langsung.
 */
const ROLE_SELALU_PENUH = ['admin', 'superadmin'];

/**
 * Tingkat akses seseorang di modul Incentive PTS.
 *
 * Full Access (access_level='full') SELALU 'penuh' di sini juga - bukan
 * cuma isyarat, ini kebijakan eksplisit: "kalau Team diberi Full Access
 * dia layak seperti Admin, tanpa batasan dan tanpa menu yang di-hide" -
 * berlaku di SEMUA modul, termasuk Incentive PTS, lewat SATU toggle yang
 * sama di Kelola Akun. Sebelum ini, Manager PTS yang sudah Full Access di
 * modul lain tetap harus diatur ULANG secara terpisah di tab Pengaturan
 * Akses Incentive PTS - dua toggle untuk satu maksud yang sama, dan admin
 * baru yang lupa menyetel yang kedua akan mengunci pimpinannya sendiri
 * lagi persis seperti T-5.
 *
 * `incentive_akses` (kolom Incentive PTS sendiri) tetap ada dan tetap
 * dipakai - itu untuk GUEST yang diberi akses "Izinkan" (mereka tidak
 * punya toggle Full Access sama sekali, karena bukan Team), dan untuk
 * admin yang ingin memberi seorang Team akses 'penuh' TANPA menjadikannya
 * Full Access di modul lain - kasus yang lebih sempit, tetap harus bisa.
 */
export function tingkatAkses(u: PemilikAkses | null | undefined): TingkatAkses {
  if (!u) return 'lihat';
  if (ROLE_SELALU_PENUH.includes((u.role || '').toLowerCase())) return 'penuh';
  if ((u.access_level || '') === 'full') return 'penuh';
  const set = (u.incentive_akses || '') as TingkatAkses;
  if (set === 'penuh' || set === 'input' || set === 'lihat') return set;
  /*
    Kolom baru belum diisi - jatuh ke kolom lama supaya migrasi tidak mencabut
    izin siapa pun. Petugas yang selama ini boleh mengisi nominal tetap boleh
    mengisi nominal pada menit pertama sesudah rilis ini, tanpa admin harus
    menyetel ulang satu per satu.
  */
  return u.allow_incentive_input ? 'input' : 'lihat';
}

/** Boleh mengubah konfigurasi modul (skema, akses, brand, process batch). */
export function bisaKonfigPenuh(u: PemilikAkses | null | undefined): boolean {
  return tingkatAkses(u) === 'penuh';
}

/** Boleh mengisi nominal & mengelola tahapan pencairan. */
export function bisaInputNominal(u: PemilikAkses | null | undefined): boolean {
  const t = tingkatAkses(u);
  return t === 'penuh' || t === 'input';
}

/** Nilai yang sah untuk disimpan ke kolom - dipakai route server sebelum menulis. */
export function aksesSah(v: unknown): TingkatAkses | null {
  return v === 'penuh' || v === 'input' || v === 'lihat' ? v : null;
}
