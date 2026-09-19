/**
 * lib/merek-bawaan.ts - nilai bawaan & kunci penyimpanan identitas merek,
 * DIPISAH dari lib/merek.ts supaya bisa diimpor dari konteks server MURNI
 * (mis. app/manifest.ts lewat lib/merek-server.ts) tanpa ikut menarik
 * useEffect/useState - lib/merek.ts mengimpor React di level modul, dan
 * Next.js menolak me-render file semacam itu di jalur server-only seperti
 * manifest route, walau yang dipakai cuma satu konstanta objek biasa.
 */

export interface Merek {
  // ── Dashboard: header di dalam platform ──
  /** Judul besar di header, mis. "Work Management Platform". */
  namaPlatform: string;
  /** Versi pendek untuk layar sempit, mis. "WM Platform". */
  namaPlatformSingkat: string;
  /** Label di sebelah kanan garis pemisah, mis. "PTS Portal". */
  namaPortal: string;
  /** Baris kecil di bawah judul, mis. "IndoVisual Professional Tools". */
  namaPerusahaan: string;
  /**
   * Logo, diisi lewat unggahan (unggahBerkasMerek). Kosong = ikon gedung
   * bawaan. Bawaannya sekarang berkas statis /logo-mark.png - lambang
   * WorkFlow yang sama yang dipakai favicon dan ikon aplikasi, supaya
   * satu lambang muncul identik di header, login, tab peramban, dan
   * layar utama ponsel.
   */
  logoUrl: string;
  /** Warna utama - kotak logo, tombol, pranala. */
  warnaUtama: string;
  /** Warna kedua untuk gradasi kotak logo & tombol. */
  warnaUtama2: string;
  /** Warna label portal di header. */
  warnaAksen: string;
  /** Gambar latar layar dashboard (setelah login), diisi lewat unggahan. */
  gambarLatarDasbor: string;

  // ── Halaman login ──
  //  Punya warna sendiri, sengaja tidak menumpang warna dashboard: panel kiri
  //  login duduk di atas foto, jadi warna yang enak di sana belum tentu enak
  //  dipakai sebagai warna tombol di dalam platform - dan sebaliknya.
  /** Gambar latar halaman login, diisi lewat unggahan. */
  gambarLatar: string;
  /** Warna panel kiri login, awal gradasi. */
  warnaLogin: string;
  /** Warna panel kiri login, akhir gradasi. */
  warnaLogin2: string;
  /** Kepekatan panel kiri menutupi foto: '0' tembus penuh, '1' menutup rapat. */
  tembusLogin: string;
  /** Kepekatan kabut putih di sisi kanan, tempat kartu login berdiri. */
  tembusKanan: string;
  /** Kalimat sambutan besar di panel kiri login. */
  judulLogin: string;
  /** Kalimat penjelas di bawahnya. */
  subjudulLogin: string;
}

export const MEREK_BAWAAN: Merek = {
  namaPlatform: 'Work Management Platform',
  namaPlatformSingkat: 'WM Platform',
  namaPortal: 'PTS Portal',
  namaPerusahaan: 'IndoVisual Professional Tools',
  logoUrl: '/logo-mark.png',
  warnaUtama: '#e11d48',
  warnaUtama2: '#be123c',
  warnaAksen: '#c8861d',
  gambarLatarDasbor: '/IVP_Background.png',

  gambarLatar: '/IVP_Background.png',
  warnaLogin: '#be123c',
  warnaLogin2: '#881337',
  tembusLogin: '0.84',
  tembusKanan: '0.55',
  judulLogin: 'Portal Manajemen Kerja Tim PTS',
  subjudulLogin: 'Request schedule, ticket troubleshooting, design project & piket showroom — dalam satu platform yang rapi.',
};

/** Field yang dipakai halaman login - dipakai Admin Panel untuk mengelompokkan. */
export const FIELD_LOGIN = [
  'gambarLatar', 'warnaLogin', 'warnaLogin2', 'tembusLogin', 'tembusKanan',
  'judulLogin', 'subjudulLogin',
] as const satisfies readonly (keyof Merek)[];

/** Kunci baris di app_settings. Satu baris, isinya JSON. */
export const KUNCI_MEREK = 'merek';
export const KUNCI_DIVISI = 'sales_divisions';
