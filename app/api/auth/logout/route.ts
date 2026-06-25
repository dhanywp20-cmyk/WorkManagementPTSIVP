import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();

  const token = request.cookies.get('ivp_session')?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('ivp_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
