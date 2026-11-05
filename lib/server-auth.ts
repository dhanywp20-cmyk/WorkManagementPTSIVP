import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from './supabase-admin';
import { akunTertunda } from './akun-tertunda';

export interface SessionUser {
  id: string;
  username: string;
  role: string;
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
    .select('id, username, role, full_name, sales_division, team_type')
    .eq('id', session.user_id)
    .single();

  if (!user || akunTertunda(user)) return null;
  return user as SessionUser;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ['admin', 'superadmin'].includes((role ?? '').toLowerCase());
}
