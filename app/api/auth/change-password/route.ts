import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Data tidak lengkap atau password terlalu pendek.' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    if (currentPassword) {
      const stored: string = user.password ?? '';
      const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
      let valid = false;
      if (isHashed) {
        valid = await bcrypt.compare(currentPassword, stored);
      } else {
        valid = stored === currentPassword;
      }
      if (!valid) {
        return NextResponse.json({ error: 'Password lama salah!' }, { status: 401 });
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Gagal menyimpan password.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
