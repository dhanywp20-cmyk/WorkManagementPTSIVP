import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  catatPercobaan, getClientIp, muatUserMasuk, PESAN_TERKUNCI, sedangTerkunci, selesaikanMasuk,
} from '@/lib/masuk-server';
import { adalahAdmin, baca2FA, bacaPengaturan2FA } from '@/lib/dua-faktor-server';
import { buatTantangan } from '@/lib/tantangan-2fa';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();

  const ip = getClientIp(request);

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    // Lockout brute-force (lib/masuk-server.ts): ketat per username, longgar per IP (NAT kantor).
    if (await sedangTerkunci(supabase, username, ip)) {
      return NextResponse.json({ error: PESAN_TERKUNCI }, { status: 429 });
    }

    const user = await muatUserMasuk(supabase, { username });
    if (!user) {
      await catatPercobaan(supabase, username, ip, false);
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    // Ambil password hash dari user_credentials
    const { data: cred } = await supabase
      .from('user_credentials')
      .select('password_hash')
      .eq('user_id', user.id)
      .single();

    if (!cred?.password_hash) {
      // Tidak ada credential - akun belum dimigrasi atau tidak punya password
      await catatPercobaan(supabase, username, ip, false);
      return NextResponse.json({ error: 'Akun belum aktif. Hubungi admin.' }, { status: 401 });
    }

    // Verifikasi password
    const stored = cred.password_hash;
    const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
    let valid = false;

    if (isHashed) {
      valid = await bcrypt.compare(password, stored);
    } else {
      // Plaintext tersisa - bandingkan lalu upgrade ke bcrypt
      valid = stored === password;
      if (valid) {
        const hash = await bcrypt.hash(password, 12);
        await supabase.from('user_credentials')
          .update({ password_hash: hash })
          .eq('user_id', user.id);
      }
    }

    if (!valid) {
      await catatPercobaan(supabase, username, ip, false);
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    // Verifikasi dua langkah (migrasi 049). Password benar belum berarti masuk: akun ber-2FA,
    // atau admin saat "wajib 2FA admin" menyala, menerima tiket 5 menit untuk /api/auth/login-2fa.
    // Gagal membaca status 2FA = tolak (jangan sampai galat basis data melewatkan 2FA).
    if (process.env.SUPABASE_JWT_SECRET) {
      let baris;
      try { baris = await baca2FA(supabase, user.id); } catch {
        return NextResponse.json({ error: 'Login gagal. Coba lagi.' }, { status: 503 });
      }
      if (baris?.aktif) {
        return NextResponse.json({ tahap: 'kode_2fa', tantangan: buatTantangan(user.id, 'kode_2fa') });
      }
      if (adalahAdmin(user.role) && (await bacaPengaturan2FA(supabase)).wajibAdmin) {
        return NextResponse.json({ tahap: 'daftar_2fa', tantangan: buatTantangan(user.id, 'daftar_2fa') });
      }
    }

    return await selesaikanMasuk(supabase, user, request, ip);

  } catch {
    return NextResponse.json({ error: 'Login gagal. Coba lagi.' }, { status: 500 });
  }
}
