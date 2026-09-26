/**
 * lib/web-push-server.ts - kirim push notification asli lewat Web Push
 * (bunyi + notifikasi sistem walau app/tab peramban sedang tertutup).
 * HANYA untuk sisi server - memakai kunci privat VAPID dan service_role.
 *
 * Kunci VAPID dibaca lewat bacaRahasia() (tabel rahasia_integrasi, diisi
 * admin lewat Admin Panel -> Integrations, lihat /api/push/setup), BUKAN
 * langsung dari process.env - platform ini dijual ke banyak company, dan
 * setiap pemasangan butuh pasangan kunci sendiri tanpa perlu deploy ulang.
 */

import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase-admin';
import { bacaRahasia } from '@/lib/rahasia-server';
import { kirimFcmKeUser } from '@/lib/fcm-server';

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

let vapidTerpasang: string | null = null; // subject email yang terakhir dipasang, penanda sudah setKeys

/** Pasang kunci VAPID ke instance webpush ini kalau belum. Null bila belum di-setup admin. */
async function pastikanVapidTerpasang(): Promise<boolean> {
  const [publicKey, privateKey] = await Promise.all([
    bacaRahasia('push.vapid_public_key'),
    bacaRahasia('push.vapid_private_key'),
  ]);
  if (!publicKey || !privateKey) return false;
  // setVapidDetails murah dipanggil berulang - tidak ada koneksi jaringan di
  // dalamnya, jadi tidak perlu cache selain penanda sederhana ini.
  if (vapidTerpasang !== publicKey) {
    webpush.setVapidDetails('mailto:admin@indovisual.local', publicKey, privateKey);
    vapidTerpasang = publicKey;
  }
  return true;
}

/**
 * Kirim push ke SEMUA perangkat terdaftar milik sekumpulan user.
 * Best-effort penuh: satu perangkat gagal tidak menggagalkan yang lain, dan
 * fungsi ini TIDAK PERNAH throw - dipanggil dari alur notifikasi biasa yang
 * tidak boleh terhenti gara-gara push gagal terkirim.
 *
 * Subscription yang sudah mati (endpoint dicabut/kadaluwarsa - gateway push
 * menjawab 404/410) dihapus otomatis, supaya tabel push_subscriptions tidak
 * menumpuk baris yang percuma dikirimi selamanya.
 */
export async function kirimPushKeUser(userIds: string[], payload: PushPayload): Promise<void> {
  // Aplikasi Android (FCM) berjalan paralel dan tidak bergantung pada VAPID.
  const fcm = kirimFcmKeUser(userIds, payload);
  try {
    if (!userIds.length) return;
    const siap = await pastikanVapidTerpasang();
    if (!siap) return; // belum di-setup admin - diam saja, bukan galat

    const db = getAdminClient();
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds);
    if (!subs || subs.length === 0) return;

    const badan = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      url: payload.url ?? '/dashboard',
    });

    const matiIds: string[] = [];
    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          badan,
        );
      } catch (e: any) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) matiIds.push(s.id);
        // Kegagalan lain (jaringan, 5xx sisi gateway push) dibiarkan - bukan
        // tanda subscription-nya mati, cuma gagal sesaat.
      }
    }));

    if (matiIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', matiIds);
    }
  } catch {
    /* jangan pernah melempar - lihat catatan di kepala fungsi */
  } finally {
    await fcm;
  }
}
