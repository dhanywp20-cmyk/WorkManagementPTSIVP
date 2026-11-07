import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserLengkap } from '@/lib/ai-server';
import type { Cakupan } from '@/lib/integrasi/token';
import type { EfekSamping } from '@/lib/efek-samping';
import { SARING_PENERIMA_ADMIN, type PenerimaAdmin } from '@/lib/penerima-admin';

export interface KonteksAksi {
  db: SupabaseClient;
  admin: SupabaseClient;
  u: UserLengkap;
  cakupan: Cakupan[];
  efek: EfekSamping;
  muatAturan?: () => Promise<void>;
}

export type HasilAksi = Record<string, unknown> & { ok: boolean; galat?: string };

export const BARIS = 25;

export function hariIniWIB(offset = 0): string {
  return new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);
}
export function jamWIB(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16);
}
export function bersih(v: unknown, maks = 60): string {
  return String(v ?? '').replace(/[%*,()\\"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);
}
export function teks(v: unknown, maks: number): string {
  return String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maks);
}
export const tglSah = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
export const jamSah = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
export const idSah = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{8,64}$/i.test(v) ? v : null);
export const gagal = (galat: string): HasilAksi => ({ ok: false, galat });

export function adalahAtasan(u: UserLengkap): boolean {
  const r = (u.role ?? '').toLowerCase();
  const j = (u.jabatan ?? '').toLowerCase();
  return r === 'admin' || r === 'superadmin' || u.access_level === 'full' || /supervisor|manager|head|kepala/.test(j);
}

export const peranDari = (u: { role?: string | null }) => (u.role ?? '').toLowerCase().trim();
export const adalahPTS = (u: { role?: string | null }) => ['admin', 'superadmin', 'team', 'team_pts'].includes(peranDari(u));

export interface AkunTambahan {
  pimpinan: boolean;
  is_internal_sales: boolean;
  piket_akses: string | null;
  piket_ubah: boolean;
  incentive_akses: string | null;
  phone_number: string | null;
}
export async function akunTambahan(k: KonteksAksi): Promise<AkunTambahan> {
  const { data } = await k.admin.from('users').select('*').eq('id', k.u.id).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    pimpinan: r.pimpinan === true,
    is_internal_sales: r.is_internal_sales === true,
    piket_akses: typeof r.piket_akses === 'string' ? r.piket_akses : null,
    piket_ubah: r.piket_ubah === true,
    incentive_akses: typeof r.incentive_akses === 'string' ? r.incentive_akses : null,
    phone_number: typeof r.phone_number === 'string' ? r.phone_number : null,
  };
}

export async function penerimaAdminServer(db: SupabaseClient): Promise<PenerimaAdmin[]> {
  const kolom = 'id, full_name, username, phone_number';
  const { data, error } = await db.from('users').select(kolom).or(SARING_PENERIMA_ADMIN);
  if (!error) return (data ?? []) as PenerimaAdmin[];
  const { data: mundur } = await db.from('users').select(kolom).in('role', ['admin', 'superadmin']);
  return (mundur ?? []) as PenerimaAdmin[];
}

export const samaNama = (x: string | null | undefined, y: string | null | undefined) =>
  (x ?? '').trim().toLowerCase() === (y ?? '').trim().toLowerCase() && !!(y ?? '').trim();
