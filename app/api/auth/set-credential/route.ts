import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/set-credential
 * Set password PERTAMA kali untuk user baru (registrasi publik / admin create-user).
 * Hashing dilakukan di server, lalu disimpan ke user_credentials lewat admin client
 * — supaya browser tidak perlu menulis langsung ke tabel kredensial (yang akan
 * dikunci dari anon lewat RLS).
 *
 * Aman dipanggil tanpa session: HANYA boleh untuk akun yang BELUM punya kredensial
 * (cek di bawah). Reset/ubah password akun existing tetap lewat change-password /
 * forgot-password (verify-otp).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, password } = await request.json();
    if (!userId || !password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Pastikan user-nya ada
    const { data: user } = await supabase
      .from('users').select('id').eq('id', userId).maybeSingle();
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Hanya set pertama kali — tolak bila sudah ada kredensial (cegah dipakai
    // sebagai jalur reset password tanpa otorisasi).
    const { data: existing } = await supabase
      .from('user_credentials').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Akun sudah memiliki password.' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    const { error } = await supabase
      .from('user_credentials')
      .insert({ user_id: userId, password_hash: hash, algorithm: 'bcrypt' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan kredensial.' }, { status: 500 });
  }
}
