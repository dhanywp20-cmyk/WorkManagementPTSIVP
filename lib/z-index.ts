/**
 * Skala z-index terpusat — SATU tangga untuk seluruh platform.
 *
 * ── Kenapa ini perlu ada ────────────────────────────────────────────────────
 * Sebelumnya ada dua skala yang bersaing (lib/z-index.ts dan Z di
 * lib/constants.ts) dengan angka berbeda untuk nama yang sama, ditambah
 * puluhan angka lepas di JSX: 100, 110, 120, 150, 200, 210, 220, 300, 9990,
 * 9995, 9996, 9998, 9999, 20000, 99999.
 *
 * Angka-angka liar itu SELAMA INI tidak menimbulkan masalah bukan karena
 * benar, tapi karena tiap halaman membungkus isinya dengan `relative z-10`.
 * Pembungkus itu membentuk stacking context, jadi z-index di dalamnya hanya
 * dibandingkan sesama isi halaman — tidak pernah bertemu overlay dari halaman
 * atau komponen lain. Begitu satu overlay lolos ke <body> (lewat portal),
 * perbandingannya jadi lintas-liga dan urutannya kacau: modal z-[110] muncul
 * DI BELAKANG modal z-[100] yang di-portal.
 *
 * Pembungkus `relative z-10` sudah dibongkar (lihat komentar di tiap halaman),
 * jadi sekarang SEMUA overlay dibandingkan di liga yang sama. Karena itu
 * angkanya harus konsisten lintas berkas — dan itulah gunanya berkas ini.
 *
 * ── Aturan pakai ────────────────────────────────────────────────────────────
 * Jangan menulis angka z-index baru di JSX. Ambil dari sini, supaya urutan
 * tumpukan bisa dibaca dari NAMA, bukan ditebak dari besarnya angka.
 *
 * Urutan dari bawah ke atas:
 */
export const Z = {
  /** Konten biasa yang perlu naik sedikit di dalam kartunya sendiri. */
  base: 1,

  /** Dropdown/menu yang menempel pada pemicunya (bukan overlay layar penuh). */
  dropdown: 40,

  /** Header/kolom yang menempel saat digulir. */
  sticky: 50,

  /** Dropdown milik SalesPicker — di atas sticky, di bawah overlay. */
  picker: 55,

  /** Latar gelap sidebar mobile. */
  sidebarScrim: 180,

  /** Sidebar mobile itu sendiri. */
  sidebar: 190,

  /**
   * Modal DASAR: detail layar penuh, form utama, overlay loading halaman.
   * Ini lapisan default untuk popup yang dibuka langsung dari halaman.
   */
  overlay: 1000,

  /**
   * Modal DI ATAS modal dasar: assign, reject, edit, konfirmasi yang dibuka
   * dari dalam modal `overlay`.
   */
  overlayTop: 1100,

  /** Lapisan ketiga — modal yang dibuka dari dalam `overlayTop`. Jarang. */
  overlayMax: 1200,

  /** Onboarding tour: latar gelap berlubang. */
  tour: 1500,
  /** Cincin sorot di sekeliling elemen yang sedang ditunjuk tour. */
  tourRing: 1501,
  /** Kartu penjelasan tour. */
  tourCard: 1502,
  /** Tombol navigasi tour. */
  tourNav: 1503,
  /** Tombol mengambang untuk membuka kembali tour. */
  tourFab: 1504,
  /** Sidebar dinaikkan saat tour agar tidak tertutup latar gelapnya. */
  tourSidebar: 1505,
  /** Item menu yang sedang disorot tour — harus di atas sidebar. */
  tourMenuItem: 1510,

  /**
   * Dialog konfirmasi yang MEMBLOKIR. Dipanggil dari mana saja, termasuk dari
   * dalam modal bertingkat, jadi harus di atas seluruh lapisan overlay —
   * kalau tidak, dialognya ter-render tapi tertutup dan klik user jatuh ke
   * modal di belakangnya, persis seperti tombol yang tidak berfungsi.
   */
  blocking: 2000,

  /** Latar gelap saat sesi habis (mengunci seluruh layar). */
  sessionScrim: 2400,
  /** Spanduk peringatan sesi habis. */
  session: 2450,

  /** Toast — tidak boleh tertutup apa pun. */
  toast: 3000,

  /** Tooltip — lapisan paling atas. */
  tooltip: 3100,
} as const;

export type ZLayer = keyof typeof Z;
