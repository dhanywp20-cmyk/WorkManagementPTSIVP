import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { cabutSemuaToken } from '@/lib/integrasi/token';

export const dynamic = 'force-dynamic';

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

const OTP_MAX_SALAH = 5;
const OTP_JENDELA_MENIT = 15;

function penandaOtp(username: string): string {
  return `otp:${username.trim().toLowerCase()}`;
}

function ambilIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();

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

    const penanda = penandaOtp(username);
    const ip = ambilIp(request);
    const mulaiJendela = new Date(Date.now() - OTP_JENDELA_MENIT * 60 * 1000).toISOString();
    const { count: salahBerturut } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('success', false)
      .eq('username', penanda)
      .gte('attempted_at', mulaiJendela);
    if ((salahBerturut ?? 0) >= OTP_MAX_SALAH) {
      return NextResponse.json(
        { error: `Terlalu banyak kode OTP salah. Coba lagi dalam ${OTP_JENDELA_MENIT} menit atau minta kode baru.` },
        { status: 429 },
      );
    }

    const catatSalah = () =>
      supabase.from('login_attempts').insert({ username: penanda, ip_address: ip, success: false });

    const otpHash = hashOTP(String(otp).trim());

    const kunci = String(username).trim().toLowerCase();
    const { data: otpRecord } = await supabase
      .from('password_reset_otps')
      .select('id, expires_at, used')
      .ilike('username', kunci)
      .eq('otp_hash', otpHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      await catatSalah();
      return NextResponse.json({ error: 'Kode OTP tidak valid.' }, { status: 400 });
    }
    if (otpRecord.used) {
      await catatSalah();
      return NextResponse.json({ error: 'Kode OTP sudah digunakan.' }, { status: 400 });
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      await catatSalah();
      return NextResponse.json({ error: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('username', kunci)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const { error: galatPassword } = await supabase
      .from('user_credentials')
      .upsert({ user_id: user.id, password_hash: hash, algorithm: 'bcrypt' }, { onConflict: 'user_id' });
    if (galatPassword) {
      return NextResponse.json({ error: 'Gagal menyimpan password baru. Coba lagi.' }, { status: 500 });
    }

    await supabase.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);

    const { error: galatSesi } = await supabase.from('user_sessions').delete().eq('user_id', user.id);
    if (galatSesi) console.error('verify-otp: gagal mencabut sesi lama', galatSesi.message);
    await cabutSemuaToken(supabase, user.id);

    await supabase.from('login_attempts').delete().eq('username', penanda);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
