import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';

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

// Panggil Fonnte langsung — tidak perlu swift-responder sebagai perantara
async function sendFonnteWA(
  target: string,
  message: string,
  token: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    const phone = target.replace(/\D/g, '').replace(/^0/, '62');
    if (!phone || phone.length < 8) {
      return { ok: false, detail: `Nomor tidak valid: "${target}"` };
    }
    const formData = new FormData();
    formData.append('target', phone);
    formData.append('message', message);
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });
    const data = await res.json();
    console.log('[forgot-password] Fonnte response:', JSON.stringify(data));
    return { ok: data?.status === true, detail: JSON.stringify(data) };
  } catch (e) {
    console.error('[forgot-password] Fonnte error:', e);
    return { ok: false, detail: String(e) };
  }
}

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();

  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    }

    // ── Rate limiting: max 3 request OTP per jam per username ────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('password_reset_otps')
      .select('*', { count: 'exact', head: true })
      .ilike('username', username.trim())
      .gte('created_at', oneHourAgo);

    if ((recentCount ?? 0) >= 3) {
      return NextResponse.json({
        error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.',
      }, { status: 429 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, phone_number')
      .ilike('username', username.trim())
      .maybeSingle();

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

    // Ambil Fonnte token dari app_settings, fallback ke env var
    const { data: tokenRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fonnte_token')
      .maybeSingle();
    const fonnteToken = tokenRow?.value || process.env.NEXT_PUBLIC_FONNTE_TOKEN || '';

    if (!fonnteToken) {
      return NextResponse.json({ error: 'Fonnte token belum dikonfigurasi.' }, { status: 500 });
    }

    const normalizedUsername = user.username; // pakai nilai persis dari DB

    // Hapus OTP lama
    await supabase
      .from('password_reset_otps')
      .delete()
      .eq('username', normalizedUsername)
      .eq('used', false);

    const otp      = generateOTP();
    const otpHash  = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from('password_reset_otps').insert({
      username:   normalizedUsername,
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

    const waResult = await sendFonnteWA(user.phone_number, waMsg, fonnteToken);

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(user.phone_number),
      message: waResult.ok
        ? `OTP dikirim ke WA ${maskPhone(user.phone_number)}`
        : `OTP dibuat tapi WA gagal dikirim. Coba kirim ulang.`,
    });

  } catch (e) {
    console.error('[forgot-password] error:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
