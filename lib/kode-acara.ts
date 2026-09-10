/**
 * lib/kode-acara.ts - bentuk & aturan pendaftaran lewat kode acara.
 *
 * Dipisah ke modulnya sendiri supaya route admin (menulis) dan route
 * registrasi (membaca) memakai SATU definisi. Keduanya berjalan di server;
 * modul ini sengaja tidak mengimpor React maupun klien Supabase peramban,
 * jadi aman diimpor route handler mana pun.
 *
 * KENAPA TABEL SENDIRI, BUKAN app_settings
 *
 * Percobaan pertama menyimpannya di app_settings dengan kunci berakhiran
 * '_secret'. Basis data MENOLAKNYA - ada trigger `tolak_rahasia_di_pengaturan`
 * yang sengaja dipasang untuk itu, dengan pesan yang jelas: app_settings bukan
 * tempat menyimpan rahasia. Penjaga itu benar: policy `as_baca` di sana
 * mengizinkan anon membaca, jadi apa pun yang masuk ke situ pada dasarnya
 * publik, dan kode acara adalah satu-satunya yang memisahkan "peserta yang
 * dikasih kode panitia" dari "siapa pun di internet".
 *
 * Jadi kodenya tinggal di tabel `pengaturan_kode_acara`: RLS menyala tanpa
 * satu pun policy dan hak akses anon/authenticated dicabut, sehingga peramban
 * ditolak di lapisan basis data - bukan sekadar "tidak diminta" oleh kode
 * aplikasi. Satu-satunya pintu adalah /api/admin/kode-acara dengan service
 * role, sesudah memastikan pemanggilnya admin.
 */

export const TABEL_KODE_ACARA = 'pengaturan_kode_acara';

export interface PengaturanKodeAcara {
  /** Gerbangnya menyala. Kalau false, kode apa pun ditolak. */
  aktif: boolean;
  /** Kode yang dibagikan panitia. */
  kode: string;
  /** ISO datetime; lewat tanggal ini kode ditolak walau `aktif` masih true. */
  berlakuSampai: string | null;
}

/** Baris mentah dari tabel - nama kolomnya snake_case, bentuk luar camelCase. */
export interface BarisKodeAcara {
  aktif?: boolean | null;
  kode?: string | null;
  berlaku_sampai?: string | null;
}

export function dariBaris(baris: BarisKodeAcara | null | undefined): PengaturanKodeAcara | null {
  if (!baris) return null;
  return {
    aktif: baris.aktif === true,
    kode: typeof baris.kode === 'string' ? baris.kode.trim() : '',
    berlakuSampai: baris.berlaku_sampai ?? null,
  };
}

/**
 * Bersihkan isi yang datang dari permintaan HTTP. Kembalikan null kalau
 * bentuknya sama sekali tidak dikenali - dibedakan dari "dikenali tapi mati".
 */
export function rapikanKodeAcara(mentah: unknown): PengaturanKodeAcara | null {
  if (!mentah || typeof mentah !== 'object' || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const kode = typeof o.kode === 'string' ? o.kode.trim() : '';
  const sampai = typeof o.berlakuSampai === 'string' && o.berlakuSampai.trim()
    ? o.berlakuSampai.trim() : null;
  return { aktif: o.aktif === true, kode, berlakuSampai: sampai };
}

export type StatusKodeAcara = 'kosong' | 'valid' | 'tidak_valid';

/**
 * Menentukan status kode yang dikirim pendaftar terhadap satu pengaturan.
 *
 * Tiga status, bukan boolean: kode yang SALAH KETIK tidak boleh diperlakukan
 * sama dengan field yang DIKOSONGKAN. Yang pertama harus ditolak dengan pesan;
 * yang kedua wajar dan lanjut ke pendaftaran normal (menunggu approval).
 */
export function periksaKodeAcara(
  kodeDikirim: string,
  pengaturan: PengaturanKodeAcara | null,
): StatusKodeAcara {
  if (!kodeDikirim) return 'kosong';
  if (!pengaturan || !pengaturan.aktif || !pengaturan.kode) return 'tidak_valid';
  if (kodeDikirim !== pengaturan.kode) return 'tidak_valid';

  if (pengaturan.berlakuSampai) {
    const batas = new Date(pengaturan.berlakuSampai);
    if (!Number.isNaN(batas.getTime()) && new Date() > batas) return 'tidak_valid';
  }
  return 'valid';
}
