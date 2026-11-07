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

export function namaSah(v: unknown): string | null {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
  return s || null;
}

export async function cabutSemuaToken(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.from('token_integrasi').update({ dicabut: new Date().toISOString() })
    .eq('user_id', userId).is('dicabut', null);
  if (error) console.error('cabutSemuaToken: gagal mencabut token integrasi', error.message);
}
