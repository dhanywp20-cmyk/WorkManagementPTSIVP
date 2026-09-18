/**
 * /api/push/subscribe - daftarkan perangkat (browser/HP) ini untuk menerima
 * push notification asli. Dipanggil PushProvider (client) sesudah pengguna
 * mengizinkan notifikasi dan berhasil pushManager.subscribe().
 *
 * Dijaga pastikanMasuk() (bukan pastikanAdmin) - siapa pun yang sudah login
 * boleh mendaftarkan perangkatnya sendiri, sama seperti pola "hubungkan"
 * Telegram di /api/notifikasi/telegram.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const endpoint = (body.endpoint ?? '').trim();
  const p256dh = (body.keys?.p256dh ?? '').trim();
  const auth = (body.keys?.auth ?? '').trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, alasan: 'Data subscription tidak lengkap.' }, { status: 400 });
  }

  const db = getAdminClient();
  //  onConflict endpoint: satu endpoint (satu instalasi service worker di satu
  //  browser) cuma boleh terikat ke satu baris. Kalau orang logout lalu login
  //  sebagai akun lain di browser yang sama, upsert ini memindahkan endpoint
  //  itu ke akun yang baru - bukan menumpuk baris lama yang salah alamat.
  const { error } = await db.from('push_subscriptions').upsert({
    user_id: jaga.user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: (body.userAgent ?? req.headers.get('user-agent') ?? '').slice(0, 300),
  }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
