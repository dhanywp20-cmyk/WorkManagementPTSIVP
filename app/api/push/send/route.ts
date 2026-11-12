
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { kirimPushKeUser } from '@/lib/notifikasi/web-push-server';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { user_ids?: string[]; title?: string; body?: string; url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const userIds = (body.user_ids ?? []).filter((s): s is string => typeof s === 'string' && !!s).slice(0, 300);
  const judulAsli = typeof body.title === 'string' ? body.title : '';
  const title = judulAsli.trim().slice(0, 120);
  const url = typeof body.url === 'string' && /^\/(?!\/)/.test(body.url) ? body.url.slice(0, 300) : undefined;
  if (!userIds.length || !title) return NextResponse.json({ ok: false, alasan: 'user_ids/title kosong.' });

  const { data: notif } = await getAdminClient()
    .from('notifications').select('user_id')
    .in('user_id', userIds).eq('title', judulAsli).eq('is_read', false);
  const sah = [...new Set((notif ?? []).map(n => n.user_id as string))];
  if (!sah.length) return NextResponse.json({ ok: false, alasan: 'Tidak ada notifikasi yang cocok.' }, { status: 403 });

  await kirimPushKeUser(sah, { title, body: typeof body.body === 'string' ? body.body.slice(0, 400) : undefined, url });
  return NextResponse.json({ ok: true });
}
