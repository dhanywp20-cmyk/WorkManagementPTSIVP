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

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, full_name, phone_number')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (userErr || !user) {
      // Pesan generik agar tidak reveal apakah username ada
      return NextResponse.json({
        success: true,
        maskedPhone: '****',
        message: 'Jika username terdaftar dan memiliki nomor WA, OTP akan dikirim.',
      });
    }

    if (!user.phone_number) {
      return NextResponse.json({
        error: 'Akun ini tidak memiliki nomor WA terdaftar. Hubungi admin untuk menambahkan nomor WA.',
      }, { status: 400 });
    }

    // Hapus OTP lama yang belum dipakai
    await supabase
      .from('password_reset_otps')
      .delete()
      .eq('username', username.trim().toLowerCase())
      .eq('used', false);

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from('password_reset_otps').insert({
      username: username.trim().toLowerCase(),
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error('[forgot-password] insert error:', insertErr);
      return NextResponse.json({
        error: 'Gagal membuat OTP. Pastikan tabel password_reset_otps sudah dibuat di Supabase.',
      }, { status: 500 });
    }

    // Kirim OTP via WA
    const waBase = process.env.NEXT_PUBLIC_WA_API_URL ?? '';
    let waSent = false;

    if (waBase) {
      const waMsg = [
        `🔐 *Reset Password IVP Portal*`,
        '━━━━━━━━━━━━━━━━━━',
        `Halo *${user.full_name}*,`,
        ``,
        `Kode OTP untuk reset password kamu:`,
        ``,
        `*${otp}*`,
        ``,
        `Berlaku selama *${OTP_EXPIRY_MINUTES} menit*.`,
        `Jangan berikan kode ini kepada siapapun.`,
        '━━━━━━━━━━━━━━━━━━',
        'Jika kamu tidak meminta reset password, abaikan pesan ini.',
      ].join('\n');

      try {
        const waRes = await fetch(`${waBase}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: user.phone_number, message: waMsg }),
        });
        waSent = waRes.ok;
      } catch (e) {
        console.error('[forgot-password] WA send error:', e);
      }
    }

    // Jika WA API tidak dikonfigurasi, kembalikan OTP langsung di response (development only)
    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(user.phone_number),
      message: waSent
        ? `OTP dikirim ke WA ${maskPhone(user.phone_number)}`
        : isDev
          ? `[DEV] OTP: ${otp} (WA API tidak dikonfigurasi)`
          : `OTP disiapkan. WA API belum dikonfigurasi — hubungi admin.`,
      ...(isDev && !waSent ? { devOtp: otp } : {}),
    });

  } catch (e) {
    console.error('[forgot-password] error:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
