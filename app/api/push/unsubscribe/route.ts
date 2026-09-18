/**
 * /api/push/unsubscribe - lepas pendaftaran push perangkat ini.
 * Dipanggil saat pengguna mematikan saklar notifikasi, atau saat logout dari
 * perangkat itu (dipanggil best-effort, bukan bagian wajib alur logout).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { endpoint?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const endpoint = (body.endpoint ?? '').trim();
  if (!endpoint) return NextResponse.json({ ok: false, alasan: 'Endpoint kosong.' }, { status: 400 });

  const db = getAdminClient();
  //  Dibatasi ke akun pemanggil sendiri - endpoint milik akun lain di
  //  perangkat lain tidak boleh ikut terhapus lewat jalur ini.
  const { error } = await db.from('push_subscriptions')
    .delete().eq('endpoint', endpoint).eq('user_id', jaga.user.id);
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
