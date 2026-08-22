/**
 * lib/merek.ts - identitas tampilan platform (merek) dan daftar divisi sales,
 * dibaca dari database supaya bisa diubah tanpa menyunting kode.
 *
 * Dua hal yang dulu terpaku di kode dan karenanya hanya bisa diubah lewat
 * deploy:
 *
 *   1. Nama platform, nama portal, nama perusahaan, logo, dan warna panel -
 *      tersebar di halaman login dan header dashboard.
 *   2. SALES_DIVISIONS - daftar 27 divisi yang disalin PERSIS SAMA di lima
 *      berkas shared.ts. Menambah satu divisi berarti menyunting lima berkas,
 *      dan satu saja yang terlewat membuat divisi itu muncul di sebagian menu.
 *
 * Keduanya sekarang disimpan di `app_settings` (tabel kunci-nilai yang sudah
 * dipakai untuk manager_user_id dan jadwal reminder).
 *
 * NILAI BAWAAN DI BAWAH SENGAJA PERSIS SAMA dengan yang selama ini tampil.
 * Jadi selama baris pengaturannya belum ada - atau gagal dibaca - platform
 * tampil tepat seperti sebelumnya, bukan kosong atau berubah sendiri.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Merek

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
  /** Logo, diisi lewat unggahan (unggahBerkasMerek). Kosong = ikon bawaan. */
  logoUrl: string;
  /** Warna utama - kotak logo, tombol, pranala. */
  warnaUtama: string;
  /** Warna kedua untuk gradasi kotak logo & tombol. */
  warnaUtama2: string;
  /** Warna label portal di header. */
  warnaAksen: string;

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
  logoUrl: '',
  warnaUtama: '#e11d48',
  warnaUtama2: '#be123c',
  warnaAksen: '#c8861d',

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

// Divisi sales

/**
 * Daftar bawaan - salinan persis daftar yang sebelumnya ada di lima berkas
 * shared.ts. Dipakai kalau baris pengaturannya belum ada, supaya menambah
 * kemampuan ini tidak mengosongkan satu pun dropdown yang sedang dipakai.
 */
export const DIVISI_BAWAAN: string[] = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
];

// Simpanan sementara

/**
 * Kedua nilai disimpan di module scope DAN sessionStorage.
 *
 * Module scope: puluhan berkas mengimpor daftar divisi ini: tanpa simpanan,
 * tiap dropdown akan memanggil database sendiri-sendiri.
 *
 * sessionStorage: header dan halaman login dirender sebelum panggilan pertama
 * selesai. Tanpa nilai yang sudah tersimpan, merek yang sudah diganti akan
 * berkedip memperlihatkan nilai bawaan dulu setiap kali halaman dimuat ulang.
 */
const SIMPAN_MEREK = 'ivp_merek';
const SIMPAN_DIVISI = 'ivp_divisi';

function bacaSimpanan<T>(kunci: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const mentah = window.sessionStorage.getItem(kunci);
    return mentah ? (JSON.parse(mentah) as T) : null;
  } catch { return null; }
}

function tulisSimpanan(kunci: string, nilai: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(kunci, JSON.stringify(nilai)); } catch { /* kuota penuh - abaikan */ }
}

let merekSekarang: Merek = { ...MEREK_BAWAAN, ...(bacaSimpanan<Partial<Merek>>(SIMPAN_MEREK) ?? {}) };
// Dipasang sedini mungkin supaya CSS tidak sempat memakai warna bawaan lebih
// dulu lalu berkedip ke warna merek saat pemuatan selesai.
if (typeof document !== 'undefined') {
  queueMicrotask(() => tulisWarnaKeCSS());
}
let divisiSekarang: string[] = bacaSimpanan<string[]>(SIMPAN_DIVISI) ?? DIVISI_BAWAAN;

/** Merek yang sedang berlaku. Selalu lengkap - field yang tidak diatur diisi bawaan. */
export function merek(): Merek { return merekSekarang; }

/** Daftar divisi sales yang sedang berlaku. Tidak pernah kosong. */
export function divisiSales(): string[] { return divisiSekarang; }

// Pemuatan

/**
 * Baca satu nilai app_settings.
 *
 * Kolom `value` menerima dua bentuk, tergantung tipe kolomnya di database:
 * teks berisi JSON (kolom text) atau nilai yang sudah terurai (kolom jsonb).
 * Keduanya diterima di sini, karena menebak salah satunya akan membuat
 * pengaturan yang sudah tersimpan tampak tidak pernah ada.
 */
function uraikan(nilai: unknown): unknown {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai === 'object') return nilai;
  if (typeof nilai !== 'string') return null;
  try { return JSON.parse(nilai); } catch { return null; }
}

let pemuatan: Promise<void> | null = null;

/**
 * Muat merek & divisi dari database. Aman dipanggil berkali-kali: panggilan
 * yang datang saat pemuatan masih berjalan ikut menunggu yang sama.
 *
 * Kegagalan apa pun - jaringan, baris belum ada, JSON rusak - dibiarkan dan
 * nilai yang sedang berlaku dipertahankan. Pengaturan tampilan tidak pantas
 * menghalangi orang bekerja.
 */
export function muatMerek(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data } = await supabase
        .from('app_settings').select('key, value')
        .in('key', [KUNCI_MEREK, KUNCI_DIVISI]);
      for (const baris of (data ?? []) as { key: string; value: unknown }[]) {
        const isi = uraikan(baris.value);
        if (isi === null) continue;
        if (baris.key === KUNCI_MEREK) {
          // Digabung dengan bawaan, bukan menggantikannya: field yang belum
          // pernah diisi tetap punya nilai, tidak berubah jadi string kosong.
          merekSekarang = { ...MEREK_BAWAAN, ...bersihkanMerek(isi as Partial<Merek>) };
          tulisSimpanan(SIMPAN_MEREK, merekSekarang);
          tulisWarnaKeCSS();
          beriTahuPendengar();
        } else if (baris.key === KUNCI_DIVISI) {
          const bersih = rapikanDivisi(isi);
          // Daftar kosong ditolak: satu kesalahan simpan tidak boleh membuat
          // SEMUA dropdown divisi di platform jadi kosong.
          if (bersih.length > 0) {
            divisiSekarang = bersih;
            tulisSimpanan(SIMPAN_DIVISI, bersih);
            beriTahuPendengar();
          }
        }
      }
    } catch { /* pertahankan nilai yang sedang berlaku */ }
  })();
  return pemuatan;
}

/** Paksa muat ulang - dipakai setelah pengaturan disimpan dari Admin Panel. */
export function muatUlangMerek(): Promise<void> { pemuatan = null; return muatMerek(); }

/** Buang field yang bukan milik Merek dan nilai non-string. */
function bersihkanMerek(isi: Partial<Merek>): Partial<Merek> {
  const hasil: Partial<Merek> = {};
  for (const kunci of Object.keys(MEREK_BAWAAN) as (keyof Merek)[]) {
    const nilai = isi[kunci];
    if (typeof nilai === 'string' && nilai.trim() !== '') hasil[kunci] = nilai.trim();
  }
  return hasil;
}

/**
 * Ubah warna hex jadi rgba dengan tingkat tembus pandang tertentu.
 *
 * Dipakai panel kiri halaman login: gambar latar harus tetap terlihat menembus
 * warna merek, jadi warnanya tidak bisa dipakai pekat begitu saja. Nilai yang
 * bukan hex 6 digit dikembalikan apa adanya - biar warna bernama seperti
 * "tomato" tetap tampil, bukan berubah jadi hitam.
 */
export function warnaTembus(hex: string, alfa: number): string {
  const cocok = /^#([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!cocok) return hex;
  const n = parseInt(cocok[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/**
 * Baca angka kepekatan yang disimpan sebagai teks.
 *
 * Nilainya datang dari <input>, jadi bisa berupa apa saja - termasuk kosong
 * atau salah ketik. Yang di luar 0..1 dikembalikan ke nilai bawaan, bukan
 * dipakai apa adanya: kepekatan 5 membuat panel kirinya menutup rapat dan
 * fotonya hilang sama sekali.
 */
export function angkaTembus(nilai: string, bawaan: number): number {
  const n = Number.parseFloat(nilai);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : bawaan;
}

/** Gradasi panel kiri halaman login, sesuai warna & kepekatan yang diatur. */
export function gradasiPanelLogin(m: Merek): string {
  const a = angkaTembus(m.tembusLogin, 0.84);
  // Ujung kedua dibuat sedikit lebih pekat, seperti aslinya - gradasi yang
  // rata terasa datar di atas foto.
  return `linear-gradient(135deg, ${warnaTembus(m.warnaLogin, Math.min(1, a - 0.02))}, ${warnaTembus(m.warnaLogin2, Math.min(1, a + 0.02))})`;
}

/** Rapikan daftar divisi: buang yang kosong, buang kembar, pertahankan urutan. */
export function rapikanDivisi(isi: unknown): string[] {
  if (!Array.isArray(isi)) return [];
  const terlihat = new Set<string>();
  const hasil: string[] = [];
  for (const x of isi) {
    if (typeof x !== 'string') continue;
    const nilai = x.trim();
    if (!nilai) continue;
    const kunci = nilai.toLowerCase();
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push(nilai);
  }
  return hasil;
}

// Penyimpanan (Admin Panel)

/** Simpan merek. Hanya field yang BERBEDA dari bawaan yang ditulis. */
export async function simpanMerek(baru: Merek): Promise<{ error: string | null }> {
  const ringkas: Partial<Merek> = {};
  for (const kunci of Object.keys(MEREK_BAWAAN) as (keyof Merek)[]) {
    const nilai = (baru[kunci] ?? '').trim();
    if (nilai && nilai !== MEREK_BAWAAN[kunci]) ringkas[kunci] = nilai;
  }
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_MEREK, value: JSON.stringify(ringkas) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  merekSekarang = { ...MEREK_BAWAAN, ...ringkas };
  tulisSimpanan(SIMPAN_MEREK, merekSekarang);
  tulisWarnaKeCSS();
  beriTahuPendengar();
  return { error: null };
}

/** Simpan daftar divisi. Menolak daftar kosong. */
export async function simpanDivisi(baru: string[]): Promise<{ error: string | null }> {
  const bersih = rapikanDivisi(baru);
  if (bersih.length === 0) return { error: 'Daftar divisi tidak boleh kosong.' };
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_DIVISI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  divisiSekarang = bersih;
  tulisSimpanan(SIMPAN_DIVISI, bersih);
  beriTahuPendengar();
  return { error: null };
}

/**
 * Divisi yang MASIH DIPAKAI akun, walau sudah dihapus dari daftar.
 *
 * Dipanggil sebelum menghapus: divisi yang hilang dari daftar sementara masih
 * tercatat di akun orang akan membuat dropdown profil mereka tampil kosong,
 * dan penyaringan per divisi berhenti menemukan pekerjaannya.
 */
export async function divisiTerpakai(): Promise<Record<string, number>> {
  const { data } = await supabase.from('users').select('sales_division');
  const hitung: Record<string, number> = {};
  for (const b of (data ?? []) as { sales_division: string | null }[]) {
    const d = (b.sales_division ?? '').trim();
    if (d) hitung[d] = (hitung[d] ?? 0) + 1;
  }
  return hitung;
}

// Unggahan berkas

/**
 * Bucket tempat logo & gambar latar disimpan.
 *
 * `merek-files` dibuat oleh sql/pengaturan-merek.sql. Selama berkas SQL itu
 * belum dijalankan bucket-nya belum ada, jadi unggahan jatuh ke `project-files`
 * yang sudah dipakai platform - dengan begitu tombol Unggah tetap berfungsi
 * hari ini, bukan menunggu satu langkah SQL lebih dulu.
 */
const BUCKET_MEREK = 'merek-files';
const BUCKET_CADANGAN = 'project-files';

/** Batas ukuran berkas yang diterima. */
const BATAS_LOGO = 2 * 1024 * 1024;
const BATAS_LATAR = 8 * 1024 * 1024;

/**
 * Unggah logo atau gambar latar, kembalikan URL publiknya.
 *
 * Logo TIDAK dikompres. compressImage() menyandi ulang jadi JPEG, dan JPEG
 * tidak punya lapisan tembus pandang - logo dengan latar transparan akan
 * pulang membawa kotak putih di belakangnya. Gambar latar aman dikompres:
 * ia memang foto, dan ukuran aslinya dari kamera bisa berkali lipat dari yang
 * dibutuhkan layar.
 */
export async function unggahBerkasMerek(
  berkas: File,
  jenis: 'logo' | 'latar',
): Promise<{ url: string | null; error: string | null }> {
  if (!berkas.type.startsWith('image/')) {
    return { url: null, error: 'Berkasnya harus gambar (PNG, JPG, SVG, atau WebP).' };
  }
  const batas = jenis === 'logo' ? BATAS_LOGO : BATAS_LATAR;
  if (berkas.size > batas) {
    return { url: null, error: `Ukurannya ${(berkas.size / 1048576).toFixed(1)}MB, batasnya ${batas / 1048576}MB.` };
  }

  let siap = berkas;
  if (jenis === 'latar') {
    try {
      const { compressImage } = await import('./image-compress');
      siap = await compressImage(berkas, { maxDim: 2400, quality: 0.82 });
    } catch { /* kompresi gagal - unggah aslinya, lebih baik besar daripada tidak jadi */ }
  }

  const ext = (siap.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  // Nama diacak, bukan nama asli: mengunggah "logo.png" dua kali tidak boleh
  // saling menimpa, dan berkas lama harus tetap utuh selama masih dirujuk
  // oleh peramban yang sudah menyimpannya di cache.
  const nama = `merek/${jenis}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  for (const bucket of [BUCKET_MEREK, BUCKET_CADANGAN]) {
    const { error } = await supabase.storage.from(bucket)
      .upload(nama, siap, { cacheControl: '31536000', upsert: false, contentType: siap.type });
    if (!error) {
      return { url: supabase.storage.from(bucket).getPublicUrl(nama).data.publicUrl, error: null };
    }
    // Bucket belum ada - coba yang berikutnya. Galat lain (kuota, izin) tidak
    // akan hilang dengan pindah bucket, jadi langsung dilaporkan.
    const pesan = (error.message || '').toLowerCase();
    if (!pesan.includes('not found') && !pesan.includes('bucket')) {
      return { url: null, error: error.message };
    }
  }
  return { url: null, error: 'Tidak ada bucket penyimpanan yang bisa dipakai. Jalankan sql/pengaturan-merek.sql.' };
}

// Jembatan ke CSS

/**
 * Tuliskan warna merek sebagai CSS custom property di <html>.
 *
 * Tanpa ini, warna merek hanya bisa dipakai lewat `style={{}}` di komponen
 * React - dan itu menutup pintu bagi CSS biasa, pseudo-element, dan keadaan
 * seperti :hover / :focus-visible yang tidak punya padanan inline.
 *
 * Menggantikan --ivp-brand di app/globals.css, yang nilainya dipatok merah
 * rose dan karenanya menjadi sumber warna KEDUA di samping database.
 */
export function tulisWarnaKeCSS(m: Merek = merekSekarang): void {
  if (typeof document === 'undefined') return;
  const akar = document.documentElement;
  akar.style.setProperty('--merek-utama', m.warnaUtama);
  akar.style.setProperty('--merek-utama-2', m.warnaUtama2);
  akar.style.setProperty('--merek-aksen', m.warnaAksen);
  akar.style.setProperty('--merek-utama-tembus', warnaTembus(m.warnaUtama, 0.1));
}

// Jembatan React

/**
 * Pendengar yang perlu dirender ulang saat pengaturan berubah.
 *
 * Tanpa ini, dropdown yang SUDAH terpasang saat pemuatan selesai akan terus
 * menampilkan daftar bawaan sampai halamannya dibuka ulang - dan divisi yang
 * baru ditambahkan seperti tidak tersimpan.
 */
const pendengar = new Set<() => void>();

function beriTahuPendengar(): void { for (const f of pendengar) f(); }

function pakaiPengaturan<T>(ambil: () => T): T {
  const [nilai, setNilai] = useState<T>(ambil);
  useEffect(() => {
    const segarkan = () => setNilai(ambil());
    pendengar.add(segarkan);
    void muatMerek().then(segarkan);
    return () => { pendengar.delete(segarkan); };
    // ambil() selalu membaca variabel modul yang sama, jadi tidak perlu ikut
    // sebagai dependensi - memasukkannya justru memasang ulang tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return nilai;
}

/** Merek yang sedang berlaku, ikut berubah saat pengaturan disimpan. */
export function useMerek(): Merek { return pakaiPengaturan(merek); }

/** Daftar divisi sales yang sedang berlaku. Tidak pernah kosong. */
export function useDivisiSales(): string[] { return pakaiPengaturan(divisiSales); }
