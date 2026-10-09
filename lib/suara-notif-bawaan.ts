/**
 * lib/suara-notif-bawaan.ts - pengaturan suara notifikasi (Admin Panel › Kelompok & Notifikasi):
 * berkas suara unggahan Admin & volume. Murni (tanpa React/Supabase) - diuji di uji/suara-notif.ts.
 *
 * Berlaku untuk ALARM DI HALAMAN (web & aplikasi Android saat terbuka). Notifikasi push di HP
 * memakai suara sistem / suara bawaan APK - peramban & kanal notifikasi Android tidak bisa diganti
 * dari server.
 */

export const KUNCI_SUARA_NOTIF = 'suara_notifikasi';
export const BERKAS_BAWAAN = '/notif.wav';

export interface SuaraNotif { url: string | null; nama: string; volume: number }
export const SUARA_BAWAAN: SuaraNotif = { url: null, nama: 'Bawaan (denting)', volume: 0.55 };

export const MAKS_BYTE_SUARA = 1024 * 1024;
export const MAKS_DETIK_SUARA = 6;
export const TIPE_SUARA: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac',
};

const jepit = (v: number, min: number, maks: number) => Math.min(maks, Math.max(min, v));

/** URL suara yang diterima: hanya https (Supabase Storage) atau jalur lokal /...; selain itu = bawaan. */
export function urlSuaraSah(u: unknown): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  const v = u.trim();
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try { return new URL(v).protocol === 'https:' ? v : null; } catch { return null; }
}

/** Nilai app_settings (objek / teks JSON / rusak) -> pengaturan lengkap & aman. */
export function bacaSuaraNotif(nilai: unknown): SuaraNotif {
  let o: unknown = nilai;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const x = (o && typeof o === 'object' && !Array.isArray(o) ? o : {}) as Record<string, unknown>;
  const url = urlSuaraSah(x.url);
  const vol = typeof x.volume === 'number' && Number.isFinite(x.volume) ? jepit(x.volume, 0.1, 1) : SUARA_BAWAAN.volume;
  const nama = typeof x.nama === 'string' && x.nama.trim() ? x.nama.trim().slice(0, 80) : (url ? 'Suara unggahan' : SUARA_BAWAAN.nama);
  return { url, nama: url ? nama : SUARA_BAWAAN.nama, volume: Math.round(vol * 100) / 100 };
}

/** Berkas yang akan diputar. */
export const sumberSuara = (s: SuaraNotif) => s.url ?? BERKAS_BAWAAN;

/** Periksa berkas unggahan sebelum dikirim: tipe audio yang dikenal & ukuran. null = boleh. */
export function periksaBerkasSuara(tipe: string, ukuran: number): string | null {
  if (!TIPE_SUARA[tipe]) return 'Berkasnya harus suara MP3, WAV, OGG, M4A/AAC, atau WebM.';
  if (ukuran > MAKS_BYTE_SUARA) return `Ukurannya ${(ukuran / 1048576).toFixed(1)} MB, batasnya 1 MB.`;
  if (ukuran <= 0) return 'Berkasnya kosong.';
  return null;
}

/** Durasi: notifikasi harus singkat - suara panjang mengganggu & boros kuota unduhan. */
export function periksaDurasiSuara(detik: number): string | null {
  if (!Number.isFinite(detik) || detik <= 0) return 'Durasi suara tidak terbaca - coba berkas lain.';
  if (detik > MAKS_DETIK_SUARA) return `Durasinya ${detik.toFixed(1)} detik, maksimal ${MAKS_DETIK_SUARA} detik.`;
  return null;
}
