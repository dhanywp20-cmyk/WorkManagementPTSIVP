/**
 * lib/token-integrasi.ts - token pribadi untuk DIWAYPI (asisten desktop pemegang akun).
 *
 * Bentuk token: "dwp_" + 32 karakter base64url (24 byte acak). Yang disimpan hanya SHA-256-nya
 * (tabel token_integrasi, migrasi 056); token penuh hanya terlihat sekali saat dibuat.
 *
 * Token ini BUKAN sesi: ia tidak membuka route lain mana pun - pastikanMasuk() tetap hanya
 * menerima cookie. Satu-satunya pintu yang menerimanya adalah /api/integrasi/diwaypi, dengan
 * daftar aksi yang tetap (lib/integrasi-aksi.ts). Jadi token bocor tidak bisa dipakai untuk
 * mengganti password, membuat akun, atau membaca rahasia.
 */
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const AWALAN = 'dwp_';
export const MAKS_TOKEN_PER_USER = 5;
export type Cakupan = 'baca' | 'tulis';

const BENTUK = /^dwp_[A-Za-z0-9_-]{32}$/;

export function buatTokenMentah(): string {
  return AWALAN + crypto.randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function bentukSah(token: string): boolean {
  return BENTUK.test(token);
}

/** "Bearer dwp_..." -> token, atau null bila bentuknya tidak sah. */
export function ambilBearer(header: string | null | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const t = header.slice(7).trim();
  return bentukSah(t) ? t : null;
}

export interface PemegangToken {
  tokenId: string;
  userId: string;
  cakupan: Cakupan[];
}

interface BarisToken { id: string; user_id: string; cakupan: string[] | null; dicabut: string | null; terakhir_dipakai: string | null }

/**
 * Cocokkan token dengan tabel. Pencarian lewat hash (kolom unik), lalu hash dibandingkan lagi
 * waktu-konstan: hasil DB tidak dipercaya begitu saja sebagai bukti kecocokan.
 * `terakhir_dipakai` diperbarui paling sering sekali per 5 menit (hemat tulis).
 */
export async function verifikasiToken(db: SupabaseClient, token: string | null): Promise<PemegangToken | null> {
  if (!token || !bentukSah(token)) return null;
  const hash = hashToken(token);
  const { data } = await db.from('token_integrasi')
    .select('id, user_id, cakupan, dicabut, terakhir_dipakai, token_hash')
    .eq('token_hash', hash).maybeSingle();
  const b = data as (BarisToken & { token_hash: string }) | null;
  if (!b || b.dicabut) return null;
  if (!crypto.timingSafeEqual(Buffer.from(b.token_hash), Buffer.from(hash))) return null;
  const lama = b.terakhir_dipakai ? Date.now() - new Date(b.terakhir_dipakai).getTime() : Infinity;
  if (lama > 5 * 60_000) {
    await db.from('token_integrasi').update({ terakhir_dipakai: new Date().toISOString() }).eq('id', b.id);
  }
  const cakupan = (b.cakupan ?? ['baca']).filter((c): c is Cakupan => c === 'baca' || c === 'tulis');
  return { tokenId: b.id, userId: b.user_id, cakupan };
}

/** Nama token dari isian pengguna: dipangkas, tanpa karakter kontrol, 1-60 karakter. */
export function namaSah(v: unknown): string | null {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
  return s || null;
}

/**
 * Cabut semua token integrasi milik satu akun. Dipanggil bersama penghapusan sesi saat password
 * diganti / di-reset: kalau akun dicurigai dibobol, token yang sempat dibuat pembobol harus ikut
 * mati - token tidak punya masa berlaku, jadi tanpa ini ia hidup terus. Gagal = dicatat, tidak
 * membatalkan penggantian password yang sudah tersimpan.
 */
export async function cabutSemuaToken(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.from('token_integrasi').update({ dicabut: new Date().toISOString() })
    .eq('user_id', userId).is('dicabut', null);
  if (error) console.error('cabutSemuaToken: gagal mencabut token integrasi', error.message);
}
