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

// Bidang & tinta

/**
 * Warna BIDANG dan TINTA (ditambahkan 2026-09-25). Pengukuran: 226 kode hex
 * berbeda di app/ & components/; lima merah berbeda dipakai bergantian untuk
 * arti yang sama. Status sudah punya WARNA di atas - ini melengkapi sisanya:
 * latar halaman, permukaan, garis, dan tiga tingkat tinta.
 *
 * Cerminnya ada di app/globals.css (--halaman, --tinta, ...) dan kelas
 * Tailwind (bg-halaman, text-tinta-2, border-garis, ...) - ketiganya HARUS
 * sama; ubah bersamaan. Nilai di sini hex, bukan var(), karena banyak kode
 * merangkai alfa seperti `${warna}40`.
 */
export const NETRAL = {
  /** Latar halaman - bidang tenang, bukan foto. */
  halaman: '#f3f5f8',
  permukaan: '#ffffff',
  /** Bidang tenggelam: header tabel, isian nonaktif, trek meter. */
  permukaanRedam: '#f8fafc',
  garis: '#e2e8f0',
  garisKuat: '#cbd5e1',
  /** Teks utama. */
  tinta: '#0f172a',
  /** Teks sekunder: label, keterangan. */
  tinta2: '#475569',
  /** Teks samar: sumbu, placeholder, catatan kecil - bukan isi utama. */
  tinta3: '#94a3b8',
} as const;

/** Gaya latar halaman untuk pembungkus terluar tiap modul. */
export const LATAR_HALAMAN: { background: string } = { background: NETRAL.halaman };

/**
 * Warna SERI untuk chart kategori (identitas, BUKAN status). Urutan tetap,
 * tidak diputar ulang; kategori ke-9 dilipat ke "Lainnya". Divalidasi dengan
 * pemeriksa buta warna (CVD ΔE terburuk 9.1, normal-vision 19.6). Tiga rona
 * terang (#1baf7a, #eda100, #e87ba4) kontrasnya < 3:1 terhadap putih, jadi
 * chart yang memakainya wajib punya legenda berlabel/angka.
 */
export const SERI = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] as const;

/** Peta teks status record (Ticket/Reminder/Request) -> WARNA. Kunci huruf kecil. */
const STATUS_KE_WARNA: Record<string, NamaWarna> = {
  solved: 'berhasil', done: 'berhasil', selesai: 'berhasil', approved: 'berhasil', paid: 'berhasil', completed: 'berhasil', lulus: 'berhasil',
  pending: 'info', processed: 'info', 'in progress': 'info', in_progress: 'info', proses: 'info', 'process repair': 'info', open: 'info',
  'waiting approval': 'awas', waiting: 'awas', menunggu: 'awas', review: 'awas', warranty: 'awas', 'submit rma': 'awas',
  overdue: 'bahaya', rejected: 'bahaya', ditolak: 'bahaya', blocked: 'bahaya', 'out of warranty': 'bahaya', gagal: 'bahaya',
  cancelled: 'netral', canceled: 'netral', batal: 'netral', archived: 'netral', draft: 'netral',
};

/** Nama warna untuk teks status bebas; tak dikenal -> 'netral'. */
export function warnaUntukStatus(status: string | null | undefined): NamaWarna {
  return STATUS_KE_WARNA[(status ?? '').trim().toLowerCase()] ?? 'netral';
}

/**
 * Warna status TICKET untuk chart & lencana. Dulu disalin identik di tiga
 * berkas (kpi-team/shared, DashboardKPI, dashboard/kpi-bagian) - kini satu.
 * Nilainya sengaja tidak diubah supaya chart yang sudah dikenal tim tidak
 * berganti warna.
 */
export const WARNA_STATUS_TICKET: Record<string, string> = {
  'Waiting Approval': '#f59e0b', 'Pending': '#3b82f6', 'Solved': '#10b981',
  'Cancelled': '#6b7280', 'Overdue': '#ef4444', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Process Repair': '#f97316', 'Submit RMA': '#06b6d4',
};
