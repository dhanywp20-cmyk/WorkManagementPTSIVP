import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const OTP_EXPIRY_MINUTES = 10;

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '****';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, phone_number')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (!user) {
      // Kembalikan pesan generik agar tidak reveal apakah username ada
      return NextResponse.json({ error: 'Jika username terdaftar, OTP akan dikirim ke WA.' }, { status: 200 });
    }

    if (!user.phone_number) {
      return NextResponse.json({ error: 'Akun ini tidak memiliki nomor WA terdaftar. Hubungi admin.' }, { status: 400 });
    }

    // Hapus OTP lama yang belum dipakai untuk username ini
    await supabase.from('password_reset_otps').delete().eq('username', username).eq('used', false);

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase.from('password_reset_otps').insert({
      username: username.trim().toLowerCase(),
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    // Kirim OTP via WA
    const waMsg = [
      `🔐 *Reset Password IVP Portal*`,
      '━━━━━━━━━━━━━━━━━━',
      `Halo *${user.full_name}*,`,
      '',
      `Kode OTP untuk reset password kamu:`,
      ``,
      `*${otp}*`,
      ``,
      `Berlaku selama *${OTP_EXPIRY_MINUTES} menit*.`,
      `Jangan berikan kode ini kepada siapapun.`,
      '━━━━━━━━━━━━━━━━━━',
      'Jika kamu tidak meminta reset password, abaikan pesan ini.',
    ].join('\n');

    const waBase = process.env.NEXT_PUBLIC_WA_API_URL ?? '';
    if (waBase) {
      try {
        await fetch(`${waBase}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: user.phone_number, message: waMsg }),
        });
      } catch { }
    }

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(user.phone_number),
      message: `OTP dikirim ke WA ${maskPhone(user.phone_number)}`,
    });

  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
