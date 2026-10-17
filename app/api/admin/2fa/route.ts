/**
 * /api/admin/2fa - Admin Panel -> Sistem -> Keamanan Login.
 *  GET                                   -> { wajibAdmin, aktif: user_id[] }
 *  POST { aksi:'atur', wajibAdmin }      -> wajib 2FA untuk semua admin (pemanggil harus sudah ber-2FA)
 *  POST { aksi:'reset', user_id }        -> hapus 2FA satu akun (HP hilang) - login berikutnya password saja,
 *                                           atau diminta mendaftar ulang bila admin & wajib.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { baca2FA, bacaPengaturan2FA, KUNCI_PENGATURAN_2FA } from '@/lib/dua-faktor-server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  const db = getAdminClient();
  const [atur, { data, error }] = await Promise.all([
    bacaPengaturan2FA(db),
    db.from('user_2fa').select('user_id').eq('aktif', true),
  ]);
  if (error) return NextResponse.json({ error: 'Status 2FA tidak terbaca.' }, { status: 503 });
  return NextResponse.json({ wajibAdmin: atur.wajibAdmin, aktif: (data ?? []).map(r => r.user_id) });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  const db = getAdminClient();
  const body = await req.json().catch(() => ({}));

  if (body?.aksi === 'atur') {
    const wajibAdmin = body?.wajibAdmin === true;
    if (wajibAdmin && !(await baca2FA(db, jaga.user.id))?.aktif) {
      return NextResponse.json({ error: 'Aktifkan 2FA akun Anda dulu (Profil → Keamanan).' }, { status: 409 });
    }
    const { error } = await db.from('app_settings')
      .upsert({ key: KUNCI_PENGATURAN_2FA, value: JSON.stringify({ wajibAdmin }) }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, wajibAdmin });
  }

  if (body?.aksi === 'reset') {
    const userId = String(body?.user_id ?? '');
    if (!UUID.test(userId)) return NextResponse.json({ error: 'Akun tidak dikenal.' }, { status: 400 });
    const { error } = await db.from('user_2fa').delete().eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Permintaan tidak dikenal.' }, { status: 400 });
}
