/**
 * lib/dua-faktor-server.ts - baca/tulis status 2FA pengguna (tabel user_2fa, migrasi 049) dan
 * pengaturan "wajib 2FA untuk admin" (app_settings.keamanan_2fa). Hanya untuk route server:
 * tabel user_2fa terkunci penuh dari peramban (RLS paksa, tanpa policy, tanpa grant).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buatKodeCadangan, buatRahasia, cocokKodeCadangan, cocokTotp, dekripsiRahasia, enkripsiRahasia, urlOtpauth,
} from '@/lib/totp';

export const KUNCI_PENGATURAN_2FA = 'keamanan_2fa';
export const PENERBIT_2FA = 'Work Management';

export interface Pengaturan2FA { wajibAdmin: boolean }

export function rapikanPengaturan2FA(mentah: unknown): Pengaturan2FA {
  let isi = mentah;
  if (typeof isi === 'string') { try { isi = JSON.parse(isi); } catch { isi = null; } }
  const r = (isi && typeof isi === 'object' ? isi : {}) as Record<string, unknown>;
  return { wajibAdmin: r.wajibAdmin === true };
}

export async function bacaPengaturan2FA(db: SupabaseClient): Promise<Pengaturan2FA> {
  try {
    const { data } = await db.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN_2FA).maybeSingle();
    return rapikanPengaturan2FA((data as { value?: unknown } | null)?.value);
  } catch { return { wajibAdmin: false }; }
}

export const adalahAdmin = (role?: string | null) => ['admin', 'superadmin'].includes((role ?? '').toLowerCase());

export interface Baris2FA {
  user_id: string; rahasia: string; aktif: boolean; cadangan: string[] | null;
  langkah_terakhir: number | string | null; diaktifkan_pada: string | null;
}

export async function baca2FA(db: SupabaseClient, userId: string): Promise<Baris2FA | null> {
  const { data, error } = await db.from('user_2fa').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Baris2FA | null) ?? null;
}

/**
 * Periksa kode 6 digit (authenticator) atau kode cadangan XXXX-XXXX. Bila cocok, simpan langkah
 * waktu terakhir (kode yang sama tidak bisa dipakai dua kali) / buang kode cadangan yang terpakai.
 */
export async function periksaKode2FA(
  db: SupabaseClient, baris: Baris2FA, kode: string, waktuMs = Date.now(),
): Promise<{ ok: boolean; pakaiCadangan?: boolean; sisaCadangan?: number }> {
  const masukan = String(kode ?? '').trim();
  if (!masukan || masukan.length > 20) return { ok: false };

  if (/^\d[\d\s]*$/.test(masukan)) {
    let rahasia: string;
    try { rahasia = dekripsiRahasia(baris.rahasia); } catch { return { ok: false }; }
    const langkah = cocokTotp(rahasia, masukan, waktuMs, Number(baris.langkah_terakhir ?? -1));
    if (langkah === null) return { ok: false };
    // Syarat langkah_terakhir < langkah di WHERE: dua permintaan bersamaan dengan kode sama
    // tidak bisa sama-sama lolos.
    const { data } = await db.from('user_2fa').update({ langkah_terakhir: langkah })
      .eq('user_id', baris.user_id).lt('langkah_terakhir', langkah).select('user_id');
    return { ok: (data?.length ?? 0) > 0 };
  }

  const daftar = baris.cadangan ?? [];
  const i = cocokKodeCadangan(masukan, daftar);
  if (i < 0) return { ok: false };
  const sisa = daftar.filter((_, j) => j !== i);
  const { data } = await db.from('user_2fa').update({ cadangan: sisa })
    .eq('user_id', baris.user_id).contains('cadangan', [daftar[i]]).select('user_id');
  return (data?.length ?? 0) > 0 ? { ok: true, pakaiCadangan: true, sisaCadangan: sisa.length } : { ok: false };
}

/** Mulai pendaftaran: rahasia baru (belum aktif) - ditampilkan sebagai QR sampai kode pertama benar. */
export async function mulaiDaftar2FA(db: SupabaseClient, user: { id: string; username: string }) {
  const rahasia = buatRahasia();
  const { error } = await db.from('user_2fa').upsert({
    user_id: user.id, rahasia: enkripsiRahasia(rahasia), aktif: false, cadangan: [], langkah_terakhir: -1, diaktifkan_pada: null,
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return { rahasia, url: urlOtpauth(rahasia, user.username, PENERBIT_2FA) };
}

/** Kode pertama benar -> 2FA aktif + 8 kode cadangan (teksnya hanya dikembalikan sekali ini). */
export async function aktifkanDaftar2FA(db: SupabaseClient, baris: Baris2FA, kode: string): Promise<string[] | null> {
  const cek = await periksaKode2FA(db, baris, kode);
  if (!cek.ok || cek.pakaiCadangan) return null;
  const cadangan = buatKodeCadangan();
  const { error } = await db.from('user_2fa').update({
    aktif: true, cadangan: cadangan.hash, diaktifkan_pada: new Date().toISOString(),
  }).eq('user_id', baris.user_id);
  if (error) throw new Error(error.message);
  return cadangan.teks;
}

/** Kode cadangan baru (yang lama hangus). */
export async function gantiCadangan2FA(db: SupabaseClient, userId: string): Promise<string[]> {
  const cadangan = buatKodeCadangan();
  const { error } = await db.from('user_2fa').update({ cadangan: cadangan.hash }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return cadangan.teks;
}
