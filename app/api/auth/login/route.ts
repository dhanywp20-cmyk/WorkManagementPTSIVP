import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS   = 5;
const WINDOW_MINUTES = 15;
const SESSION_HOURS  = 6;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const ip = getClientIp(request);

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const windowCutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: failCount } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .or(`username.eq.${username},ip_address.eq.${ip}`)
      .eq('success', false)
      .gte('attempted_at', windowCutoff);

    if ((failCount ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan login. Coba lagi dalam ${WINDOW_MINUTES} menit.` },
        { status: 429 }
      );
    }

    // ── Ambil user ────────────────────────────────────────────────────────
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled')
      .eq('username', username)
      .single();

    if (userErr || !user) {
      await supabase.from('login_attempts').insert({ username, ip_address: ip, success: false });
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    // ── Ambil password hash dari user_credentials ─────────────────────────
    const { data: cred } = await supabase
      .from('user_credentials')
      .select('password_hash')
      .eq('user_id', user.id)
      .single();

    if (!cred?.password_hash) {
      // Tidak ada credential — akun belum dimigrasi atau tidak punya password
      await supabase.from('login_attempts').insert({ username, ip_address: ip, success: false });
      return NextResponse.json({ error: 'Akun belum aktif. Hubungi admin.' }, { status: 401 });
    }

    // ── Verifikasi password ───────────────────────────────────────────────
    const stored = cred.password_hash;
    const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
    let valid = false;

    if (isHashed) {
      valid = await bcrypt.compare(password, stored);
    } else {
      // Plaintext tersisa — bandingkan lalu upgrade ke bcrypt
      valid = stored === password;
      if (valid) {
        const hash = await bcrypt.hash(password, 12);
        await supabase.from('user_credentials')
          .update({ password_hash: hash })
          .eq('user_id', user.id);
      }
    }

    if (!valid) {
      await supabase.from('login_attempts').insert({ username, ip_address: ip, success: false });
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    // ── Login berhasil ────────────────────────────────────────────────────
    await supabase.from('login_attempts').insert({ username, ip_address: ip, success: true });

    // Cleanup expired sessions (housekeeping)
    supabase.from('user_sessions').delete().lt('expires_at', new Date().toISOString()).then(() => {});

    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash    = hashToken(sessionToken);
    const expiresAt    = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();

    await supabase.from('user_sessions').insert({
      user_id: user.id,
      token_hash: tokenHash,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? '',
      expires_at: expiresAt,
    });

    const response = NextResponse.json({ user });
    response.cookies.set('ivp_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_HOURS * 3600,
      path: '/',
    });
    return response;

  } catch {
    return NextResponse.json({ error: 'Login gagal. Coba lagi.' }, { status: 500 });
  }
}
