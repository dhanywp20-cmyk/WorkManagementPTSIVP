import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';
import { cabutSemuaToken } from '@/lib/token-integrasi';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }

    const caller = await getSessionUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
    }
    const isSelf = caller.id === userId;
    if (!isSelf && !isAdminRole(caller.role) && !currentPassword) {
      return NextResponse.json({ error: 'Tidak berwenang mengubah password user lain.' }, { status: 403 });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json({ error: 'Password harus mengandung minimal 1 huruf kapital.' }, { status: 400 });
    }
    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: 'Password harus mengandung minimal 1 angka.' }, { status: 400 });
    }

    if (currentPassword) {
      const { data: cred } = await supabase
        .from('user_credentials')
        .select('password_hash')
        .eq('user_id', userId)
        .single();

      if (!cred?.password_hash) {
        return NextResponse.json({ error: 'Credential tidak ditemukan.' }, { status: 404 });
      }

      const isHashed = cred.password_hash.startsWith('$2b$') || cred.password_hash.startsWith('$2a$');
      const valid = isHashed
        ? await bcrypt.compare(currentPassword, cred.password_hash)
        : cred.password_hash === currentPassword;

      if (!valid) {
        return NextResponse.json({ error: 'Password lama salah!' }, { status: 401 });
      }
    }

    const hash = await bcrypt.hash(newPassword, 12);

    const { error: upsertErr } = await supabase
      .from('user_credentials')
      .upsert({ user_id: userId, password_hash: hash, algorithm: 'bcrypt' }, { onConflict: 'user_id' });

    if (upsertErr) {
      return NextResponse.json({ error: 'Gagal menyimpan password baru.' }, { status: 500 });
    }

    await supabase.from('user_sessions').delete().eq('user_id', userId);
    await cabutSemuaToken(supabase, userId);

    const { data: targetUser } = await supabase
      .from('users').select('username').eq('id', userId).maybeSingle();
    if (targetUser?.username) {
      await supabase.from('login_attempts').delete()
        .eq('username', targetUser.username).eq('success', false);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
