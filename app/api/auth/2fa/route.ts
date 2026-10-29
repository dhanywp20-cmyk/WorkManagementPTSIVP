/**
 * /api/auth/2fa - pengguna yang sudah masuk mengatur 2FA akunnya sendiri (Profil -> Keamanan).
 *  GET                         -> { aktif, sisaCadangan, wajib }
 *  POST { aksi:'mulai' }       -> { rahasia, url } untuk QR
 *  POST { aksi:'aktifkan', kode }    -> { cadangan }  (teks kode cadangan hanya tampil sekali)
 *  POST { aksi:'cadangan', kode }    -> { cadangan }  (kode lama hangus)
 *  POST { aksi:'matikan', kode }     -> { ok }        (ditolak bila admin & wajib 2FA admin)
 * Kode salah dihitung ke lockout login (5 gagal / 15 menit per username).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { bolehDiwaypiDan2FA } from '@/lib/constants';
import { catatPercobaan, getClientIp, PESAN_TERKUNCI, sedangTerkunci } from '@/lib/masuk-server';
import {
  adalahAdmin, aktifkanDaftar2FA, baca2FA, bacaPengaturan2FA, gantiCadangan2FA, mulaiDaftar2FA, periksaKode2FA,
} from '@/lib/dua-faktor-server';

export const dynamic = 'force-dynamic';

const jawab = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return jawab({ error: jaga.alasan }, jaga.status);
  const db = getAdminClient();
  try {
    const [baris, atur] = await Promise.all([baca2FA(db, jaga.user.id), bacaPengaturan2FA(db)]);
    return jawab({
      aktif: !!baris?.aktif,
      sisaCadangan: baris?.aktif ? (baris.cadangan ?? []).length : 0,
      wajib: atur.wajibAdmin && adalahAdmin(jaga.user.role),
      siap: !!process.env.SUPABASE_JWT_SECRET,
    });
  } catch {
    return jawab({ error: 'Status 2FA tidak terbaca.' }, 503);
  }
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return jawab({ error: jaga.alasan }, jaga.status);
  if (!process.env.SUPABASE_JWT_SECRET) return jawab({ error: 'Server belum siap untuk 2FA.' }, 503);
  const db = getAdminClient();
  const ip = getClientIp(req);
  const user = jaga.user;

  try {
    const body = await req.json().catch(() => ({}));
    const aksi = String(body?.aksi ?? '');
    const kode = String(body?.kode ?? '');
    if (await sedangTerkunci(db, user.username, ip)) return jawab({ error: PESAN_TERKUNCI }, 429);

    const baris = await baca2FA(db, user.id);
    const kodeSalah = async () => {
      await catatPercobaan(db, user.username, ip, false);
      return jawab({ error: 'Kode salah atau sudah dipakai.' }, 400);
    };

    //  Mendaftar 2FA hanya untuk admin & akun Full Access. Yang sudah aktif tetap bisa
    //  mengganti kode cadangan / mematikannya (mis. setelah Full Access dicabut).
    if ((aksi === 'mulai' || aksi === 'aktifkan') && !bolehDiwaypiDan2FA(user)) {
      return jawab({ error: '2FA hanya untuk admin & akun yang ditunjuk.' }, 403);
    }
    if (aksi === 'mulai') {
      if (baris?.aktif) return jawab({ error: '2FA sudah aktif.' }, 409);
      return jawab(await mulaiDaftar2FA(db, user));
    }
    if (aksi === 'aktifkan') {
      if (!baris || baris.aktif) return jawab({ error: 'Mulai ulang pendaftaran.' }, 409);
      const cadangan = await aktifkanDaftar2FA(db, baris, kode);
      return cadangan ? jawab({ cadangan }) : kodeSalah();
    }

    if (!baris?.aktif) return jawab({ error: '2FA belum aktif.' }, 409);
    if (aksi === 'cadangan') {
      if (!(await periksaKode2FA(db, baris, kode)).ok) return kodeSalah();
      return jawab({ cadangan: await gantiCadangan2FA(db, user.id) });
    }
    if (aksi === 'matikan') {
      if (adalahAdmin(user.role) && (await bacaPengaturan2FA(db)).wajibAdmin) {
        return jawab({ error: '2FA wajib untuk admin.' }, 403);
      }
      if (!(await periksaKode2FA(db, baris, kode)).ok) return kodeSalah();
      await db.from('user_2fa').delete().eq('user_id', user.id);
      return jawab({ ok: true });
    }
    return jawab({ error: 'Permintaan tidak dikenal.' }, 400);
  } catch {
    return jawab({ error: 'Gagal. Coba lagi.' }, 500);
  }
}
