
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { kirimPushKeUser } from '@/lib/web-push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { user_ids?: string[]; title?: string; body?: string; url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const userIds = (body.user_ids ?? []).filter((s): s is string => typeof s === 'string' && !!s).slice(0, 300);
  const title = (body.title ?? '').trim().slice(0, 120);
  const url = typeof body.url === 'string' && /^\/(?!\/)/.test(body.url) ? body.url.slice(0, 300) : undefined;
  if (!userIds.length || !title) return NextResponse.json({ ok: false, alasan: 'user_ids/title kosong.' });

  await kirimPushKeUser(userIds, { title, body: typeof body.body === 'string' ? body.body.slice(0, 400) : undefined, url });
  return NextResponse.json({ ok: true });
}
