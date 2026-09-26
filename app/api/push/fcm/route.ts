/**
 * /api/push/fcm - aplikasi Android mendaftarkan token FCM perangkatnya untuk
 * user yang sedang login (POST), atau melepasnya (DELETE). Token pindah ke
 * user yang login terakhir di perangkat itu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function bacaToken(req: NextRequest): Promise<string | null> {
  try {
    const { token } = await req.json() as { token?: string };
    return typeof token === 'string' && /^[A-Za-z0-9:_\-]{20,4096}$/.test(token) ? token : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const token = await bacaToken(req);
  if (!token) return NextResponse.json({ ok: false, alasan: 'Token tidak sah.' }, { status: 400 });

  const { error } = await getAdminClient().from('fcm_tokens').upsert(
    { token, user_id: jaga.user.id, platform: 'android', diperbarui_pada: new Date().toISOString() },
    { onConflict: 'token' },
  );
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const token = await bacaToken(req);
  if (token) await getAdminClient().from('fcm_tokens').delete().eq('token', token).eq('user_id', jaga.user.id);
  return NextResponse.json({ ok: true });
}
