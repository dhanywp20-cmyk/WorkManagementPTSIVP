import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { username, otp, newPassword } = await request.json();

    if (!username || !otp || !newPassword) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json({ error: 'Password harus mengandung minimal 1 huruf kapital.' }, { status: 400 });
    }
    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: 'Password harus mengandung minimal 1 angka.' }, { status: 400 });
    }

    const otpHash = hashOTP(String(otp).trim());

    const { data: otpRecord } = await supabase
      .from('password_reset_otps')
      .select('id, expires_at, used')
      .eq('username', username.trim().toLowerCase())
      .eq('otp_hash', otpHash)
      .single();

    if (!otpRecord) {
      return NextResponse.json({ error: 'Kode OTP tidak valid.' }, { status: 400 });
    }
    if (otpRecord.used) {
      return NextResponse.json({ error: 'Kode OTP sudah digunakan.' }, { status: 400 });
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' }, { status: 400 });
    }

    // OTP valid — ambil user id
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Update password
    const hash = await bcrypt.hash(newPassword, 12);
    await supabase
      .from('user_credentials')
      .upsert({ user_id: user.id, password_hash: hash, algorithm: 'bcrypt' }, { onConflict: 'user_id' });

    // Tandai OTP sudah dipakai
    await supabase.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);

    // Invalidate semua session aktif user ini
    await supabase.from('user_sessions').delete().eq('user_id', user.id);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
