/**
 * lib/masuk-server.ts - bagian proses masuk yang dipakai bersama /api/auth/login (password) dan
 * /api/auth/login-2fa (kode authenticator). Hanya untuk route server.
 *
 * Satu tempat untuk: hitung percobaan gagal (lockout), muat data pengguna, dan membuat sesi +
 * cookie + token basis data - supaya kedua jalur masuk selalu menghasilkan sesi yang sama persis.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { issueDbToken } from '@/lib/db-token';

export const SESSION_HOURS = 6;
/** Gagal per username (ketat) & per IP (longgar - satu kantor berbagi satu IP publik/NAT). */
export const BATAS_GAGAL_USER = 5;
export const BATAS_GAGAL_IP = 30;
const JENDELA_GAGAL_MS = 15 * 60 * 1000;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** true bila username / IP ini sedang dikunci karena terlalu banyak gagal. */
export async function sedangTerkunci(supabase: SupabaseClient, username: string, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - JENDELA_GAGAL_MS).toISOString();
  const [byUser, byIp] = await Promise.all([
    supabase.from('login_attempts').select('*', { count: 'exact', head: true })
      .eq('success', false).eq('username', username).gte('attempted_at', windowStart),
    (ip && ip !== 'unknown')
      ? supabase.from('login_attempts').select('*', { count: 'exact', head: true })
          .eq('success', false).eq('ip_address', ip).gte('attempted_at', windowStart)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);
  return (byUser.count ?? 0) >= BATAS_GAGAL_USER || (byIp.count ?? 0) >= BATAS_GAGAL_IP;
}

export const PESAN_TERKUNCI = 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.';

export async function catatPercobaan(supabase: SupabaseClient, username: string, ip: string, success: boolean) {
  await supabase.from('login_attempts').insert({ username, ip_address: ip, success });
}

export interface UserMasuk {
  id: string; username: string; full_name: string; role: string; team_type?: string | null;
  [k: string]: unknown;
}

const KOLOM_USER = 'id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled';

/**
 * Muat pengguna untuk login. access_level & piket_akses opsional - kolom baru, belum tentu ada di
 * database lama; bila kueri lengkap gagal, ulangi TANPA kolom itu supaya login tidak ikut gagal.
 */
export async function muatUserMasuk(supabase: SupabaseClient, kunci: { username: string } | { id: string }): Promise<UserMasuk | null> {
  const [kol, nilai] = 'username' in kunci ? ['username', kunci.username] : ['id', kunci.id];
  let { data, error } = await supabase.from('users')
    .select(`${KOLOM_USER}, access_level, piket_akses`).eq(kol, nilai).single();
  if (error) ({ data, error } = await supabase.from('users').select(KOLOM_USER).eq(kol, nilai).single());
  return error || !data ? null : (data as unknown as UserMasuk);
}

/** Buat sesi (tabel user_sessions + cookie ivp_session) dan kembalikan respons login lengkap. */
export async function selesaikanMasuk(supabase: SupabaseClient, user: UserMasuk, request: NextRequest, ip: string, tambahan?: Record<string, unknown>) {
  await catatPercobaan(supabase, user.username, ip, true);

  // Bersihkan sesi kedaluwarsa (housekeeping)
  supabase.from('user_sessions').delete().lt('expires_at', new Date().toISOString()).then(() => {});

  const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
  await supabase.from('user_sessions').insert({
    user_id: user.id,
    token_hash: hashToken(sessionToken),
    ip_address: ip,
    user_agent: request.headers.get('user-agent') ?? '',
    expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
  });

  // Token PostgREST - basis data mengenali pengguna ini untuk RLS. null bila
  // SUPABASE_JWT_SECRET belum diset; login tetap berhasil.
  // Penanda akun pimpinan (lib/pimpinan.ts) - kueri terpisah & toleran: bila kolom
  // belum ada (migrasi 034 belum dijalankan) hasilnya null = bukan pimpinan.
  const { data: pim } = await supabase.from('users').select('pimpinan').eq('id', user.id).maybeSingle();
  const userKeluar = { ...user, pimpinan: pim?.pimpinan === true };
  const response = NextResponse.json({
    user: userKeluar,
    db_token: issueDbToken(user as Parameters<typeof issueDbToken>[0]),
    ...tambahan,
  });
  response.cookies.set('ivp_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_HOURS * 3600,
    path: '/',
  });
  return response;
}
