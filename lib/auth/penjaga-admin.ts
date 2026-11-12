
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { bolehDiwaypiDan2FA } from '@/lib/constants';
import { akunTertunda, PESAN_TERTUNDA } from '@/lib/auth/akun-tertunda';

export interface Pemanggil {
  id: string;
  username: string;
  full_name: string;
  role: string;
  access_level?: string | null;
}

export type HasilPenjaga =
  | { ok: true; user: Pemanggil }
  | { ok: false; status: 401 | 403; alasan: string };

const PERAN_ADMIN = ['admin', 'superadmin'];

export async function pastikanMasuk(req: NextRequest): Promise<HasilPenjaga> {
  const token = req.cookies.get('ivp_session')?.value;
  if (!token) return { ok: false, status: 401, alasan: 'Belum masuk.' };

  const db = getAdminClient();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: sesi } = await db
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!sesi) return { ok: false, status: 401, alasan: 'Sesi tidak dikenal.' };
  if (new Date(sesi.expires_at) < new Date()) {
    return { ok: false, status: 401, alasan: 'Sesi kedaluwarsa.' };
  }

  const { data: user } = await db
    .from('users')
    .select('id, username, full_name, role, access_level, team_type')
    .eq('id', sesi.user_id)
    .single();

  if (!user) return { ok: false, status: 401, alasan: 'Akun tidak ditemukan.' };
  if (akunTertunda(user)) return { ok: false, status: 403, alasan: PESAN_TERTUNDA };
  return { ok: true, user: user as Pemanggil };
}

export async function pastikanAdmin(req: NextRequest): Promise<HasilPenjaga> {
  const masuk = await pastikanMasuk(req);
  if (!masuk.ok) return masuk;

  if (!PERAN_ADMIN.includes((masuk.user.role ?? '').toLowerCase())) {
    return { ok: false, status: 403, alasan: 'Hanya admin yang boleh mengubah pengaturan ini.' };
  }
  return masuk;
}

const PERAN_SEMUA_MENU = ['admin', 'superadmin', 'team', 'team_pts'];

export async function pastikanMenu(req: NextRequest, kunci: string): Promise<HasilPenjaga> {
  const masuk = await pastikanMasuk(req);
  if (!masuk.ok) return masuk;
  if (PERAN_SEMUA_MENU.includes((masuk.user.role ?? '').toLowerCase())) return masuk;
  const { data } = await getAdminClient().from('users').select('allowed_menus, pimpinan').eq('id', masuk.user.id).maybeSingle();
  const u = data as { allowed_menus?: string[] | null; pimpinan?: boolean | null } | null;
  if (u?.pimpinan || (Array.isArray(u?.allowed_menus) && u.allowed_menus.includes(kunci))) return masuk;
  return { ok: false, status: 403, alasan: 'Menu ini tidak diberikan untuk akun Anda.' };
}

export async function pastikanAksesPenuh(req: NextRequest, alasan: string): Promise<HasilPenjaga> {
  const masuk = await pastikanMasuk(req);
  if (!masuk.ok) return masuk;
  if (!bolehDiwaypiDan2FA(masuk.user)) return { ok: false, status: 403, alasan };
  return masuk;
}
