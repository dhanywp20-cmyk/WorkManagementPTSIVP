import { NextRequest, NextResponse } from 'next/server';
import { akunTertunda } from '@/lib/auth/akun-tertunda';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

const UMUR_PENDAFTARAN_MENIT = 30;

export async function POST(request: NextRequest) {
  try {
    const { userId, password } = await request.json();
    if (!userId || !password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    let { data: user } = await supabase
      .from('users').select('id, role, team_type, created_at').eq('id', userId).maybeSingle();
    if (!user) {
      ({ data: user } = await supabase
        .from('users').select('id, role, team_type').eq('id', userId).maybeSingle());
    }
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from('user_credentials').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Akun sudah memiliki password.' }, { status: 409 });
    }

    const caller = await getSessionUser(request);
    if (!caller || !isAdminRole(caller.role)) {
      const u = user as { role?: string | null; team_type?: string | null; created_at?: string | null };
      const bentukPendaftaran =
        (u.role ?? '').toLowerCase() === 'guest' &&
        akunTertunda(u);
      const masihBaru =
        !u.created_at ||
        Date.now() - new Date(u.created_at).getTime() < UMUR_PENDAFTARAN_MENIT * 60 * 1000;
      if (!bentukPendaftaran || !masihBaru) {
        return NextResponse.json(
          { error: 'Tidak berwenang memasang password untuk akun ini.' },
          { status: 403 },
        );
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const { error } = await supabase
      .from('user_credentials')
      .insert({ user_id: userId, password_hash: hash, algorithm: 'bcrypt' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan kredensial.' }, { status: 500 });
  }
}
