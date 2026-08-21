import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * OTP-nya enam angka. Tanpa pembatasan, seluruh sejuta kemungkinan bisa
 * dicoba dalam hitungan menit - dan karena tebakan yang salah tidak menemukan
 * baris apa pun di password_reset_otps, tidak ada tempat untuk menyimpan
 * hitungannya di baris OTP itu sendiri.
 *
 * Maka hitungannya disimpan di login_attempts, tabel yang sudah dipakai
 * lockout login, dengan awalan "otp:" pada kolom username supaya tidak
 * tercampur dengan percobaan login biasa. Ambangnya sengaja lebih ketat dari
 * login: OTP dikirim ke WA pemilik akun, jadi lima kali salah sudah pertanda.
 */
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

    //  ilike, bukan eq: OTP yang dibuat SEBELUM penyeragaman huruf tersimpan
    //  memakai ejaan persis dari tabel users. Mencarinya dengan eq lowercase
    //  membuat kode yang benar pun tidak ketemu barisnya, dan orangnya
    //  kehabisan cara untuk masuk kembali. maybeSingle supaya baris kembar
    //  peninggalan tidak melempar galat.
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

    // OTP valid - ambil user id
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('username', kunci)
      .maybeSingle();

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

    // Kode yang benar mengosongkan hitungan salah - kalau tidak, pemilik akun
    // yang sempat salah ketik ikut terkunci saat berikutnya butuh reset.
    await supabase.from('login_attempts').delete().eq('username', penanda);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
