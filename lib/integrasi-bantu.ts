/**
 * lib/integrasi-bantu.ts - penolong bersama aksi DIWAYPI (lib/integrasi-aksi.ts dan modul
 * per menu: lib/integrasi-menu.ts, lib/integrasi-tulis.ts, lib/integrasi-analisa.ts).
 *
 * Dipisah dari integrasi-aksi.ts supaya modul per menu tidak mengimpor balik pintu utamanya
 * (impor melingkar). Isinya tetap sama persis dengan yang dulu tertulis di sana.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserLengkap } from '@/lib/ai-server';
import type { Cakupan } from '@/lib/token-integrasi';
import type { EfekSamping } from '@/lib/efek-samping';
import { SARING_PENERIMA_ADMIN, type PenerimaAdmin } from '@/lib/penerima-admin';

export interface KonteksAksi {
  /** Klien Supabase SEBAGAI pemilik token (RLS berlaku). */
  db: SupabaseClient;
  /** Service role - hanya untuk checklist (pola route checklist) & data akun. */
  admin: SupabaseClient;
  u: UserLengkap;
  cakupan: Cakupan[];
  /** WA / in-app / audit sisi server (buatEfekServer) - pengganti fungsi peramban. */
  efek: EfekSamping;
  /**
   * Muat aturan yang di peramban dimuat saat halaman dibuka (daftar tim yang bisa
   * ditugaskan, kategori insentif). Route mengisinya; uji tidak (tanpa jaringan).
   */
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
/** Isian bebas untuk filter PostgREST (.or / ilike): tanpa karakter sintaks. */
export function bersih(v: unknown, maks = 60): string {
  return String(v ?? '').replace(/[%*,()\\"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);
}
/** Teks yang DISIMPAN: hanya dipangkas & dibatasi (boleh tanda baca). */
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
/** admin / superadmin / team / team_pts - "orang dalam PTS" di banyak halaman. */
export const adalahPTS = (u: { role?: string | null }) => ['admin', 'superadmin', 'team', 'team_pts'].includes(peranDari(u));

/**
 * Kolom akun yang tidak dibawa UserLengkap tapi dipakai aturan halaman (pimpinan, Sales
 * Internal, akses piket/insentif, nomor WA). select('*') lewat service role, baris pemilik
 * token sendiri saja: kolom yang belum dimigrasi cukup tidak ada, bukan menggagalkan query
 * seperti select dengan nama kolom yang tak dikenal.
 */
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

/**
 * penerimaAdmin() (lib/penerima-admin.ts) dengan klien pemilik token - versi peramban memakai
 * klien bersesi. Aturan & jalur mundurnya sama: admin/superadmin ATAU Full Access.
 */
export async function penerimaAdminServer(db: SupabaseClient): Promise<PenerimaAdmin[]> {
  const kolom = 'id, full_name, username, phone_number';
  const { data, error } = await db.from('users').select(kolom).or(SARING_PENERIMA_ADMIN);
  if (!error) return (data ?? []) as PenerimaAdmin[];
  const { data: mundur } = await db.from('users').select(kolom).in('role', ['admin', 'superadmin']);
  return (mundur ?? []) as PenerimaAdmin[];
}

/** Nama dibandingkan tanpa beda huruf besar & spasi tepi. */
export const samaNama = (x: string | null | undefined, y: string | null | undefined) =>
  (x ?? '').trim().toLowerCase() === (y ?? '').trim().toLowerCase() && !!(y ?? '').trim();
