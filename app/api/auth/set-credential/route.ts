import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/set-credential - memasang password PERTAMA untuk akun baru.
 * Hashing dikerjakan di server supaya browser tidak menulis ke tabel kredensial.
 *
 * Endpoint ini harus tetap bisa dipanggil TANPA sesi karena dipakai form
 * registrasi mandiri. Tabel users terbaca anon, jadi syarat "belum punya
 * kredensial" saja tidak cukup: id akun mana pun bisa dipungut lalu dipasangi
 * password. Jalur tanpa sesi karena itu dibatasi pada akun berbentuk
 * pendaftaran yang belum disetujui - role guest, team_type "Pending Approval",
 * dan masih baru bila created_at tersedia. Admin yang sesinya diverifikasi
 * bebas dari batasan itu.
 *
 * Mengganti password akun yang sudah punya kredensial tetap hanya lewat
 * change-password / verify-otp.
 */
const UMUR_PENDAFTARAN_MENIT = 30;

export async function POST(request: NextRequest) {
  try {
    const { userId, password } = await request.json();
    if (!userId || !password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // created_at belum tentu ada di tabel users - kalau kolomnya tidak dikenal
    // PostgREST menggagalkan seluruh query, jadi dicoba dulu lalu jatuh balik.
    let { data: user } = await supabase
      .from('users').select('id, role, team_type, created_at').eq('id', userId).maybeSingle();
    if (!user) {
      ({ data: user } = await supabase
        .from('users').select('id, role, team_type').eq('id', userId).maybeSingle());
    }
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Hanya set pertama kali - tolak bila sudah ada kredensial (cegah dipakai
    // sebagai jalur reset password tanpa otorisasi).
    const { data: existing } = await supabase
      .from('user_credentials').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Akun sudah memiliki password.' }, { status: 409 });
    }

    const caller = await getSessionUser(request);
    if (!caller || !isAdminRole(caller.role)) {
      const u = user as { role?: string | null; team_type?: string | null; created_at?: string | null };
      const bentukPendaftaran =
        (u.role ?? '').toLowerCase() === 'guest' &&
        (u.team_type ?? '') === 'Pending Approval';
      const masihBaru =
        !u.created_at ||
        Date.now() - new Date(u.created_at).getTime() < UMUR_PENDAFTARAN_MENIT * 60 * 1000;
      if (!bentukPendaftaran || !masihBaru) {
        return NextResponse.json(
          { error: 'Tidak berwenang memasang password untuk akun ini.' },
          { status: 403 },
        );
      }
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
