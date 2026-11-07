import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { issueDbToken } from '@/lib/auth/db-token';
import { akunTertunda } from '@/lib/auth/akun-tertunda';

export const dynamic = 'force-dynamic';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('ivp_session')?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const supabase = getAdminClient();

  const tokenHash = hashToken(token);
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled, access_level, piket_akses')
    .eq('id', session.user_id)
    .single();
  if (userErr) {
    ({ data: user } = await supabase
      .from('users')
      .select('id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled')
      .eq('id', session.user_id)
      .single());
  }

  if (!user || akunTertunda(user)) {
    if (user) await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { data: pim } = await supabase.from('users').select('pimpinan').eq('id', user.id).maybeSingle();
  return NextResponse.json({ user: { ...user, pimpinan: pim?.pimpinan === true }, db_token: issueDbToken(user) });
}
