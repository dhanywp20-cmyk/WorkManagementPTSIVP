/**
 * /api/push/setup - tombol "Aktifkan Push Notifikasi" di Admin Panel.
 *
 * Generate sepasang kunci VAPID sekali (server yang generate, bukan admin
 * yang mengetik/menempel dari luar - beda dari Telegram/WhatsApp) lalu
 * simpan ke rahasia_integrasi lewat jalur yang sama seperti token lain.
 *
 * SENGAJA menolak menimpa kunci yang sudah ada tanpa ?force=1: mengganti
 * kunci VAPID membuat SEMUA subscription lama (push_subscriptions) langsung
 * tidak sah - setiap orang yang sudah mengaktifkan notifikasi di HP-nya
 * harus mendaftar ulang. Itu ongkos nyata, jadi harus sengaja diminta admin,
 * bukan kejadian sampingan tak terduga dari klik tombol yang sama dua kali.
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { bacaRahasia, lupakanRahasia } from '@/lib/rahasia-server';

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
