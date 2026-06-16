import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
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

    // Invalidate semua session user ini (force re-login)
    await supabase.from('user_sessions').delete().eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
