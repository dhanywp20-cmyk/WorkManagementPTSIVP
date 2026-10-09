/**
 * lib/galat-tulis.ts - Penjaga terpusat "gagal diam-diam" saat MENULIS ke basis data.
 *
 * Ratusan titik simpan memanggil Supabase langsung, dan banyak yang tidak memeriksa `error` - simpan
 * yang ditolak server (izin, data tidak sah) atau putus jaringan terlihat berhasil padahal tidak ada
 * yang tersimpan. fetchWithToken (lib/supabase.ts) melewatkan setiap jawaban ke sini; penulisan yang
 * gagal diumumkan lewat event `galat-tulis`, yang ditampilkan PenjagaGalatTulis di layout akar.
 *
 * Hanya PENULISAN ke tabel (POST/PATCH/PUT/DELETE ke /rest/v1/<tabel>) - bacaan & RPC tidak, karena
 * sebagian kode sengaja mencoba query lalu jatuh ke cadangan saat gagal.
 */

export const NAMA_EVENT_GALAT_TULIS = 'galat-tulis';

export interface GalatTulis { tabel: string; pesan: string }

/**
 * Kode yang SENGAJA ditangani pemanggilnya sendiri, jadi tidak diumumkan lagi:
 * - PGRST204 / 42703: kolom belum ada di skema -> kode mencoba ulang tanpa kolom baru itu.
 * - 23505: data kembar (username dipakai, entri sudah ada) -> pemanggil memberi pesan sendiri.
 */
const KODE_DITANGANI = new Set(['PGRST204', '42703', '23505']);

/** Nama tabel dari URL PostgREST penulisan, atau null bila bukan penulisan tabel. */
export function tabelPenulisan(metode: string | undefined, url: string): string | null {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes((metode ?? 'GET').toUpperCase())) return null;
  const cocok = /\/rest\/v1\/([^/?#]+)/.exec(url);
  if (!cocok || cocok[1] === 'rpc') return null;
  return decodeURIComponent(cocok[1]);
}

/** Pesan untuk manusia dari status & isi galat PostgREST, atau null bila tidak perlu diumumkan. */
export function pesanGalatTulis(status: number, isi: { code?: string; message?: string } | null): string | null {
  if (status < 400) return null;
  if (isi?.code && KODE_DITANGANI.has(isi.code)) return null;
  if (status === 401 || status === 403 || isi?.code === '42501') return 'Tidak punya izin menyimpan perubahan ini. Coba muat ulang halaman atau masuk lagi.';
  if (isi?.code === '23503') return 'Data yang dirujuk sudah tidak ada (mungkin baru dihapus orang lain). Muat ulang halaman lalu coba lagi.';
  if (isi?.code === '23502' || isi?.code === '22P02' || isi?.code === '23514') return 'Isian tidak lengkap atau formatnya tidak sah, perubahan tidak tersimpan.';
  if (status >= 500) return 'Server sedang bermasalah, perubahan belum tersimpan. Coba lagi sebentar lagi.';
  return 'Perubahan tidak tersimpan' + (isi?.message ? `: ${isi.message}` : '.');
}

/** Umumkan galat (browser saja). */
export function umumkanGalatTulis(galat: GalatTulis): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GalatTulis>(NAMA_EVENT_GALAT_TULIS, { detail: galat }));
}

/** Dipanggil fetchWithToken untuk setiap jawaban (atau kegagalan jaringan) - tidak pernah melempar. */
export async function periksaJawabanTulis(metode: string | undefined, url: string, jawaban: Response | null): Promise<void> {
  try {
    const tabel = tabelPenulisan(metode, url);
    if (!tabel) return;
    if (!jawaban) { umumkanGalatTulis({ tabel, pesan: 'Koneksi terputus, perubahan belum tersimpan. Periksa internet lalu coba lagi.' }); return; }
    if (jawaban.ok) return;
    let isi: { code?: string; message?: string } | null = null;
    try { isi = await jawaban.clone().json(); } catch { /* isi bukan JSON */ }
    const pesan = pesanGalatTulis(jawaban.status, isi);
    if (pesan) umumkanGalatTulis({ tabel, pesan });
  } catch { /* penjaga tidak boleh mengganggu permintaan aslinya */ }
}
