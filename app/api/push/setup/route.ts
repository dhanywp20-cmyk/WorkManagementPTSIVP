
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/auth/penjaga-admin';
import { bacaRahasia, lupakanRahasia } from '@/lib/auth/rahasia-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const publicKey = await bacaRahasia('push.vapid_public_key');
  let jumlahPerangkat = 0;
  if (publicKey) {
    const db = getAdminClient();
    const { count } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true });
    jumlahPerangkat = count ?? 0;
  }
  return NextResponse.json({ ok: true, aktif: !!publicKey, jumlahPerangkat });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const force = new URL(req.url).searchParams.get('force') === '1';
  const sudahAda = await bacaRahasia('push.vapid_public_key');
  if (sudahAda && !force) {
    return NextResponse.json({
      ok: false,
      alasan: 'Push notification sudah aktif. Membuat kunci baru akan memutus SEMUA perangkat yang sudah mendaftar - konfirmasi dulu sebelum mengulang.',
      sudahAktif: true,
    }, { status: 409 });
  }

  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  const db = getAdminClient();
  const oleh = jaga.user.full_name || jaga.user.username;
  const kini = new Date().toISOString();
  const { error } = await db.from('rahasia_integrasi').upsert([
    { kunci: 'push.vapid_public_key', nilai: publicKey, diperbarui_pada: kini, diperbarui_oleh: oleh },
    { kunci: 'push.vapid_private_key', nilai: privateKey, diperbarui_pada: kini, diperbarui_oleh: oleh },
  ], { onConflict: 'kunci' });

  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  lupakanRahasia('push.vapid_public_key');
  lupakanRahasia('push.vapid_private_key');
  return NextResponse.json({ ok: true });
}
