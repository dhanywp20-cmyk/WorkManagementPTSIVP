import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from './supabase-admin';

/**
 * lib/server-auth.ts - Verifikasi session dari httpOnly cookie di sisi server.
 *
 * Dipakai route handler yang perlu tahu SIAPA pemanggilnya (bukan sekadar
 * "punya cookie") - mis. agar tidak bisa mengubah data milik user lain.
 * Token mentah TIDAK pernah keluar; yang dicocokkan hanya hash-nya.
 */
export interface SessionUser {
  id: string;
  username: string;
  role: string;
  /**
   * Diperlukan untuk menerbitkan token PostgREST: policy RLS mencocokkan
   * kepemilikan lewat klaim full_name, karena kolom sales_name & pic menyimpan
   * full name - bukan username.
   */
  full_name: string | null;
  sales_division: string | null;
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get('ivp_session')?.value;
  if (!token) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = getAdminClient();

  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  const { data: user } = await supabase
    .from('users')
    .select('id, username, role, full_name, sales_division')
    .eq('id', session.user_id)
    .single();

  return (user as SessionUser) ?? null;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ['admin', 'superadmin'].includes((role ?? '').toLowerCase());
}
