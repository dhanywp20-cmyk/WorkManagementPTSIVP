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
  /** Judul besar di header, mis. "Work Management Platform". */
  namaPlatform: string;
  /** Versi pendek untuk layar sempit, mis. "WM Platform". */
  namaPlatformSingkat: string;
  /** Label di sebelah kanan garis pemisah, mis. "PTS Portal". */
  namaPortal: string;
  /** Baris kecil di bawah judul, mis. "IndoVisual Professional Tools". */
  namaPerusahaan: string;
  /** URL logo. Kosong = pakai ikon gedung bawaan. */
  logoUrl: string;
  /** Warna utama - kotak logo, tombol, aksen fokus. */
  warnaUtama: string;
  /** Warna kedua untuk gradasi kotak logo. */
  warnaUtama2: string;
  /** Warna label portal di header. */
  warnaAksen: string;
  /** Gambar latar halaman login. */
  gambarLatar: string;
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
  judulLogin: 'Portal Manajemen Kerja Tim PTS',
  subjudulLogin: 'Request schedule, ticket troubleshooting, design project & piket showroom — dalam satu platform yang rapi.',
};

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
