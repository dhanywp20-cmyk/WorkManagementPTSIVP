/**
 * lib/desain.ts - token desain terpusat. SATU tangga untuk seluruh platform.
 *
 * Berkas ini mengikuti bentuk lib/z-index.ts: nama yang menjelaskan MAKSUD,
 * bukan angka yang harus ditebak artinya. Aturan pakainya juga sama - jangan
 * menulis nilai baru di JSX, ambil dari sini.
 *
 * KENAPA INI ADA
 *
 * Sebelum berkas ini, tailwind.config.ts tidak punya satu pun token; seluruh
 * ukuran ditulis langsung di kelas. Hasil pengukuran atas 157 berkas:
 *
 *   - radius : 7 nilai berbeda, 2.370 pemakaian. rounded-xl (797) dan
 *              rounded-lg (657) nyaris seri - artinya tidak ada aturan yang
 *              membedakan keduanya, keduanya dipilih bergantian.
 *   - shadow : 5 kelas Tailwind + sekitar 30 boxShadow inline yang berbeda.
 *   - modal  : 93 overlay `fixed inset-0` dirakit sendiri, padding p-2 sampai
 *              p-10.
 *
 * CARA PEMAKAIAN - dan batasnya
 *
 * Token ini SENGAJA tidak dipakai untuk menulis ulang 2.370 kelas yang sudah
 * ada sekaligus. Penulisan ulang massal pada platform yang sedang dipakai tim
 * setiap hari adalah cara tercepat memecahkan sesuatu tanpa ketahuan. Yang
 * dilakukan: token dipakai di komponen bersama (yang memang untuk dipakai
 * ulang) dan di semua kode baru. Halaman lama menyusul satu per satu, dengan
 * pemeriksaan visual masing-masing.
 */

// Radius

/**
 * Lima tingkat, diturunkan dari nilai yang MEMANG sudah dipakai - bukan skala
 * baru yang mengharuskan semua berubah. Yang ditambahkan hanya aturan kapan
 * memakai yang mana, karena itulah yang selama ini tidak ada.
 */
export const RADIUS = {
  /** Lencana, chip, tombol ikon kecil. Setara rounded-lg. */
  kecil: '0.5rem',
  /** Input, tombol, baris daftar. Bentuk paling sering - setara rounded-xl. */
  kontrol: '0.75rem',
  /** Kartu, panel, badan modal. Setara rounded-2xl. */
  kartu: '1rem',
  /** Panel besar yang berdiri sendiri: kartu login. Setara rounded-3xl. */
  panel: '1.5rem',
  /** Avatar, pil status, tombol bulat. */
  bulat: '9999px',
} as const;

// Bayangan

/**
 * Empat tingkat menurut SEBERAPA JAUH benda itu mengambang, bukan seberapa
 * gelap bayangannya. Nilainya diambil dari yang paling sering muncul di kode
 * sekarang, supaya tampilannya tidak berubah saat komponen mulai memakainya:
 * `0 4px 24px rgba(0,0,0,0.10)` misalnya dipakai 13 kali sebagai bayangan
 * kartu.
 */
export const BAYANG = {
  /** Kartu yang duduk di atas halaman. */
  kartu: '0 4px 24px rgba(0,0,0,0.10)',
  /** Dropdown & popover yang menempel pada pemicunya. */
  dropdown: '0 8px 32px rgba(0,0,0,0.18)',
  /** Modal yang melayang di atas layar gelap. */
  modal: '0 8px 40px rgba(0,0,0,0.18)',
  /** Toast yang muncul di pojok. */
  toast: '0 4px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
} as const;

// Jarak

/**
 * Skala jarak untuk padding dan gap. Angkanya kelipatan 4px seperti Tailwind,
 * jadi `sedang` = p-4, `longgar` = p-5, dan seterusnya - bisa dipakai
 * berdampingan dengan kelas Tailwind tanpa tabrakan.
 */
export const JARAK = {
  /** Di dalam lencana & chip. */
  rapat: '0.5rem',
  /** Di dalam input & tombol. */
  kontrol: '0.75rem',
  /** Isi kartu di layar sempit. */
  sedang: '1rem',
  /** Isi kartu & modal - bentuk baku. */
  longgar: '1.25rem',
  /** Bagian besar yang berdiri sendiri. */
  lega: '1.5rem',
} as const;

// Tipografi

/**
 * Tangga ukuran teks menurut PERANNYA di halaman.
 *
 * Yang paling sering salah di platform ini bukan ukurannya, melainkan
 * pasangannya: judul bagian kadang lebih besar daripada judul halaman di
 * layar yang sama. Karena itu tiap tingkat di bawah menyebut perannya, bukan
 * ukurannya.
 */
export const TEKS = {
  /** Judul halaman. Satu per layar. */
  judulHalaman: 'text-xl md:text-2xl font-bold tracking-tight',
  /** Judul bagian di dalam halaman. */
  judulBagian: 'text-sm font-bold text-slate-800',
  /** Judul kartu. */
  judulKartu: 'text-sm font-bold',
  /** Teks isi. */
  isi: 'text-sm',
  /** Keterangan di bawah judul atau input. */
  keterangan: 'text-xs text-slate-500',
  /** Label di atas input - huruf kapital berspasi. */
  label: 'text-[10px] font-bold tracking-widest uppercase text-slate-400',
  /** Teks bantuan yang lebih kecil dari keterangan. */
  bantuan: 'text-[11px] text-slate-400 leading-relaxed',
  /** Pesan galat pada form. */
  galat: 'text-xs font-semibold text-rose-600',
} as const;

// Warna semantik

/**
 * Warna MAKNA - bukan warna merek.
 *
 * Warna merek (utama, aksen) datang dari database lewat lib/merek.ts dan bisa
 * diganti tiap organisasi. Yang di bawah ini tidak: hijau berarti berhasil dan
 * merah berarti bahaya di mana pun platform ini dipasang, dan membiarkannya
 * ikut diganti hanya membuka pintu bagi kombinasi yang menyesatkan.
 *
 * Nilainya mengikuti palet Tailwind yang sudah dipakai di seluruh platform
 * (emerald 388 pemakaian, red 382, amber 404), jadi memakainya tidak mengubah
 * tampilan mana pun - hanya memberinya nama.
 */
export const WARNA = {
  berhasil: { utama: '#059669', teks: '#047857', latar: 'rgba(16,185,129,0.10)', garis: 'rgba(16,185,129,0.35)' },
  bahaya:   { utama: '#dc2626', teks: '#b91c1c', latar: 'rgba(239,68,68,0.10)',  garis: 'rgba(239,68,68,0.35)' },
  awas:     { utama: '#d97706', teks: '#b45309', latar: 'rgba(245,158,11,0.10)', garis: 'rgba(245,158,11,0.35)' },
  info:     { utama: '#0284c7', teks: '#0369a1', latar: 'rgba(2,132,199,0.10)',  garis: 'rgba(2,132,199,0.35)' },
  netral:   { utama: '#64748b', teks: '#475569', latar: 'rgba(100,116,139,0.08)', garis: 'rgba(100,116,139,0.25)' },
} as const;

export type NamaWarna = keyof typeof WARNA;

/** Gaya kotak berwarna - dipakai lencana, kotak pesan, dan kartu status. */
export function gayaWarna(nama: NamaWarna): { background: string; color: string; border: string } {
  const w = WARNA[nama];
  return { background: w.latar, color: w.teks, border: `1px solid ${w.garis}` };
}
