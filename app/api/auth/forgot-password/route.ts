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

// Kirim WA via Supabase Edge Function swift-responder (sama seperti reminder-schedule)
async function sendWA(target: string, message: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${supabaseUrl}/functions/v1/swift-responder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ type: 'reminder_wa', target, message }),
    });
    const data = await res.json();
    console.log('[forgot-password] WA response:', JSON.stringify(data));
    return { ok: data?.ok === true, detail: JSON.stringify(data) };
  } catch (e) {
    console.error('[forgot-password] WA send error:', e);
    return { ok: false, detail: String(e) };
  }
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
      return NextResponse.json({
        success: true,
        maskedPhone: '****',
        message: 'Jika username terdaftar dan memiliki nomor WA, OTP akan dikirim.',
      });
    }

    if (!user.phone_number) {
      return NextResponse.json({
        error: 'Akun ini tidak memiliki nomor WA terdaftar. Hubungi admin.',
      }, { status: 400 });
    }

    // Hapus OTP lama
    await supabase
      .from('password_reset_otps')
      .delete()
      .eq('username', username.trim().toLowerCase())
      .eq('used', false);

    const otp      = generateOTP();
    const otpHash  = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from('password_reset_otps').insert({
      username:   username.trim().toLowerCase(),
      otp_hash:   otpHash,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error('[forgot-password] insert error:', insertErr);
      return NextResponse.json({
        error: `Gagal insert OTP: ${insertErr.message} [code: ${insertErr.code}]`,
      }, { status: 500 });
    }

    const waMsg = [
      `🔐 *Reset Password IVP Portal*`,
      '━━━━━━━━━━━━━━━━━━',
      `Halo *${user.full_name}*,`,
      ``,
      `Kode OTP reset password kamu:`,
      ``,
      `*${otp}*`,
      ``,
      `Berlaku *${OTP_EXPIRY_MINUTES} menit*. Jangan berikan ke siapapun.`,
      '━━━━━━━━━━━━━━━━━━',
      'Abaikan pesan ini jika kamu tidak meminta reset password.',
    ].join('\n');

    const waResult = await sendWA(user.phone_number, waMsg);

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(user.phone_number),
      waSent: waResult.ok,
      waDetail: waResult.detail,
      message: waResult.ok
        ? `OTP dikirim ke WA ${maskPhone(user.phone_number)}`
        : `OTP dibuat, WA gagal: ${waResult.detail}`,
    });

  } catch (e) {
    console.error('[forgot-password] error:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
