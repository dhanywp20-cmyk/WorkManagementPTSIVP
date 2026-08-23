/**
 * lib/kunci-pengaturan.ts - satu tempat untuk seluruh kunci app_settings.
 *
 * ── KENAPA BUKAN DIGANTI NAMANYA JADI BERTITIK ─────────────────────────────
 *
 * Rencana awal fase ini adalah menyeragamkan penamaan kunci jadi bertitik
 * (mis. `manager_user_id` -> `organization.manager_user_id`). Sesudah
 * ditelusuri, keseluruhannya cuma TUJUH kunci - dan mengganti namanya berarti:
 *
 *   1. menyunting setiap tempat yang menyebutnya di kode,
 *   2. migrasi data untuk memindahkan barisnya di app_settings, DAN
 *   3. menyunting fungsi basis data boleh_hapus_reminder(), yang menyebut
 *      'manager_user_id' sebagai teks di dalam badannya.
 *
 * Kalau satu saja terlewat, kegagalannya SUNYI: Manager kehilangan hak hapus
 * jadwal, atau merek platform diam-diam kembali ke bawaan, atau pengaturan
 * lonceng hilang - tanpa satu pun pesan galat. Yang didapat sebagai gantinya
 * hanya nama yang lebih rapi. Itu pertukaran yang buruk, jadi tidak dilakukan.
 *
 * Yang DIKERJAKAN adalah bagian yang benar-benar berguna dari rencana itu:
 * kuncinya dikumpulkan di satu tempat. Sebelum berkas ini, 'manager_user_id'
 * ditulis sebagai teks mentah di lima berkas berbeda - salah ketik di salah
 * satunya menghasilkan kegagalan sunyi yang sama, dan tidak ada satu tempat
 * pun yang bisa ditanya "sebenarnya ada kunci apa saja".
 *
 * Sekarang ada. Dan kalau suatu hari penggantian nama itu memang diinginkan,
 * pekerjaannya jadi jauh lebih kecil: ubah di sini, lalu satu migrasi data
 * dan satu fungsi basis data - bukan berburu teks di seluruh repo.
 */

export const KUNCI_PENGATURAN = {
  /**
   * uuid akun Manager yang berhak approve & assign, sekaligus menghapus
   * jadwal. PENTING: nama kunci ini juga disebut di dalam fungsi basis data
   * boleh_hapus_reminder() (sql/kunci-tabel-lanjutan.sql). Mengubahnya di
   * sini saja TIDAK cukup - fungsinya ikut harus disunting.
   */
  MANAGER: 'manager_user_id',

  /** Jadwal cron reminder harian (jam, menit, hari, aktif). */
  JADWAL_REMINDER: 'reminder_schedule',

  //  Empat di bawah sudah punya konstanta sendiri di berkas pemiliknya sejak
  //  awal; didaftar ulang di sini supaya daftar ini benar-benar lengkap -
  //  daftar yang cuma memuat sebagian justru menyesatkan.
  /** Merek & tampilan platform - lihat lib/merek.ts (KUNCI_MEREK). */
  MEREK: 'merek',
  /** Daftar divisi sales - lihat lib/merek.ts (KUNCI_DIVISI). */
  DIVISI_SALES: 'sales_divisions',
  /** Kelompok kerja & akses lonceng - lihat lib/kelompok.ts. */
  KELOMPOK: 'kelompok',
  /** Lingkup Manager per kelompok - lihat lib/kelompok.ts. */
  LINGKUP_MANAGER: 'lingkup_manager',
  /** Kanal notifikasi per event - lihat lib/notifikasi/pengaturan.ts. */
  NOTIFIKASI_KANAL: 'notifikasi.kanal',
} as const;

export type KunciPengaturan = typeof KUNCI_PENGATURAN[keyof typeof KUNCI_PENGATURAN];
