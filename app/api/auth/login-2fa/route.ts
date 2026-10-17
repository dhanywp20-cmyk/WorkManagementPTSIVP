/**
 * Langkah kedua login. Dipanggil dengan tiket dari /api/auth/login:
 *  - tahap 'kode_2fa'   : { tantangan, kode }            -> sesi
 *  - tahap 'daftar_2fa' : { tantangan, aksi:'mulai' }    -> { rahasia, url } untuk QR
 *                         { tantangan, aksi:'aktifkan', kode } -> sesi + kode cadangan (sekali tampil)
 * Kode salah dihitung ke lockout login yang sama (5 gagal / 15 menit per username).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  catatPercobaan, getClientIp, muatUserMasuk, PESAN_TERKUNCI, sedangTerkunci, selesaikanMasuk,
} from '@/lib/masuk-server';
import { aktifkanDaftar2FA, baca2FA, mulaiDaftar2FA, periksaKode2FA } from '@/lib/dua-faktor-server';
import { bacaTantangan } from '@/lib/tantangan-2fa';

export const dynamic = 'force-dynamic';

const HABIS = 'Waktu verifikasi habis. Masuk ulang dengan password.';

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();
  const ip = getClientIp(request);

  try {
    const body = await request.json().catch(() => ({}));
    const tiket = bacaTantangan(body?.tantangan);
    if (!tiket) return NextResponse.json({ error: HABIS }, { status: 401 });

    const user = await muatUserMasuk(supabase, { id: tiket.uid });
    if (!user) return NextResponse.json({ error: HABIS }, { status: 401 });
    if (await sedangTerkunci(supabase, user.username, ip)) {
      return NextResponse.json({ error: PESAN_TERKUNCI }, { status: 429 });
    }

    const baris = await baca2FA(supabase, user.id);
    const gagal = async () => {
      await catatPercobaan(supabase, user.username, ip, false);
      return NextResponse.json({ error: 'Kode salah atau sudah dipakai.' }, { status: 401 });
    };

    if (tiket.tahap === 'kode_2fa') {
      if (!baris?.aktif) return NextResponse.json({ error: HABIS }, { status: 401 });
      const cek = await periksaKode2FA(supabase, baris, String(body?.kode ?? ''));
      if (!cek.ok) return gagal();
      return await selesaikanMasuk(supabase, user, request, ip,
        cek.pakaiCadangan ? { sisa_cadangan: cek.sisaCadangan } : undefined);
    }

    // tahap 'daftar_2fa' - admin wajib 2FA tapi belum mendaftar
    if (baris?.aktif) return NextResponse.json({ error: HABIS }, { status: 401 });
    if (body?.aksi === 'mulai') {
      return NextResponse.json(await mulaiDaftar2FA(supabase, user));
    }
    if (body?.aksi === 'aktifkan') {
      if (!baris) return NextResponse.json({ error: HABIS }, { status: 401 });
      const cadangan = await aktifkanDaftar2FA(supabase, baris, String(body?.kode ?? ''));
      if (!cadangan) return gagal();
      return await selesaikanMasuk(supabase, user, request, ip, { cadangan });
    }
    return NextResponse.json({ error: 'Permintaan tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Verifikasi gagal. Coba lagi.' }, { status: 500 });
  }
}
