
import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase-admin';
import { bacaRahasia } from '@/lib/auth/rahasia-server';
import { kirimFcmKeUser } from '@/lib/notifikasi/fcm-server';

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

let vapidTerpasang: string | null = null;

async function pastikanVapidTerpasang(): Promise<boolean> {
  const [publicKey, privateKey] = await Promise.all([
    bacaRahasia('push.vapid_public_key'),
    bacaRahasia('push.vapid_private_key'),
  ]);
  if (!publicKey || !privateKey) return false;
  if (vapidTerpasang !== publicKey) {
    webpush.setVapidDetails('mailto:admin@indovisual.local', publicKey, privateKey);
    vapidTerpasang = publicKey;
  }
  return true;
}

export async function kirimPushKeUser(userIds: string[], payload: PushPayload): Promise<void> {
  const fcm = kirimFcmKeUser(userIds, payload);
  try {
    if (!userIds.length) return;
    const siap = await pastikanVapidTerpasang();
    if (!siap) return;

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
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          badan,
        );
      } catch (e: any) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) matiIds.push(s.id);
      }
    }));

    if (matiIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', matiIds);
    }
  } catch {
  } finally {
    await fcm;
  }
}
