import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { issueDbToken } from '@/lib/db-token';

export const dynamic = 'force-dynamic';

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
  const supabase = getAdminClient();

  const ip = getClientIp(request);

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    // Lockout brute-force
    // Kunci per-username (threshold ketat) supaya 1 akun yang dibrute-force
    // diblok, tapi threshold IP dibuat longgar karena 1 kantor biasanya
    // berbagi 1 IP publik (NAT) - jangan sampai 1 IP mengunci semua orang.
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [byUser, byIp] = await Promise.all([
      supabase.from('login_attempts').select('*', { count: 'exact', head: true })
        .eq('success', false).eq('username', username).gte('attempted_at', windowStart),
      (ip && ip !== 'unknown')
        ? supabase.from('login_attempts').select('*', { count: 'exact', head: true })
            .eq('success', false).eq('ip_address', ip).gte('attempted_at', windowStart)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);
    if ((byUser.count ?? 0) >= 5 || (byIp.count ?? 0) >= 30) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' },
        { status: 429 },
      );
    }

    // Ambil user
    // access_level (toggle Full Access) & piket_akses opsional - kolom baru, belum tentu
    // sudah ada di database (sql/user-full-access-toggle.sql belum dijalankan).
    // Coba sertakan dulu; kalau gagal (kolom belum ada), jatuh balik TANPA
    // kolom itu supaya login tidak pernah ikut gagal gara-gara ini.
    let { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled, access_level, piket_akses')
      .eq('username', username)
      .single();
    if (userErr) {
      ({ data: user, error: userErr } = await supabase
        .from('users')
        .select('id, username, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled')
        .eq('username', username)
        .single());
    }

    if (userErr || !user) {
      await supabase.from('login_attempts').insert({ username, ip_address: ip, success: false });
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    // Ambil password hash dari user_credentials
    const { data: cred } = await supabase
      .from('user_credentials')
      .select('password_hash')
      .eq('user_id', user.id)
      .single();

    if (!cred?.password_hash) {
      // Tidak ada credential - akun belum dimigrasi atau tidak punya password
      await supabase.from('login_attempts').insert({ username, ip_address: ip, success: false });
      return NextResponse.json({ error: 'Akun belum aktif. Hubungi admin.' }, { status: 401 });
    }

    // Verifikasi password
    const stored = cred.password_hash;
    const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
    let valid = false;

    if (isHashed) {
      valid = await bcrypt.compare(password, stored);
    } else {
      // Plaintext tersisa - bandingkan lalu upgrade ke bcrypt
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

    // Login berhasil
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

    // Token PostgREST - memberi basis data cara mengenali user ini, sehingga
    // policy RLS bisa menyaring berdasarkan identitas alih-alih USING (true).
    // Bernilai null bila SUPABASE_JWT_SECRET belum diset; login tetap berhasil.
    const response = NextResponse.json({ user, db_token: issueDbToken(user) });
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
