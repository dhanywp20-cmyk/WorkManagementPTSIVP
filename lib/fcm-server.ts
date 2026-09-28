/**
 * lib/fcm-server.ts - push ke aplikasi Android lewat Firebase Cloud Messaging
 * (HTTP v1). Dipanggil kirimPushKeUser() di lib/web-push-server.ts, jadi
 * setiap notifikasi yang memicu web push ikut terkirim ke aplikasi.
 *
 * Kredensial: service account JSON dari Firebase Console, disimpan admin di
 * Admin Panel -> Integrations -> Push (rahasia_integrasi,
 * 'push.fcm_service_account'). Belum diisi = diam, bukan galat.
 */
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { bacaRahasia } from '@/lib/rahasia-server';
import type { PushPayload } from '@/lib/web-push-server';

type AkunLayanan = { project_id: string; client_email: string; private_key: string };

let tokenAkses: { nilai: string; sampai: number; email: string } | null = null;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function bacaAkunLayanan(teks: string | null): AkunLayanan | null {
  if (!teks) return null;
  try {
    const j = JSON.parse(teks);
    if (j?.project_id && j?.client_email && j?.private_key) return j as AkunLayanan;
  } catch { /* bukan JSON */ }
  return null;
}

async function ambilTokenAkses(sa: AkunLayanan): Promise<string | null> {
  const kini = Math.floor(Date.now() / 1000);
  if (tokenAkses && tokenAkses.email === sa.client_email && tokenAkses.sampai > kini + 60) return tokenAkses.nilai;

  const kepala = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const klaim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: kini, exp: kini + 3600,
  }));
  const tanda = crypto.createSign('RSA-SHA256').update(`${kepala}.${klaim}`).sign(sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${kepala}.${klaim}.${b64url(tanda)}`,
    }),
  });
  if (!r.ok) return null;
  const j = await r.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  tokenAkses = { nilai: j.access_token, sampai: kini + (j.expires_in ?? 3600), email: sa.client_email };
  return j.access_token;
}

/** Best-effort penuh: tidak pernah throw. Token yang sudah mati dihapus. */
export async function kirimFcmKeUser(userIds: string[], payload: PushPayload): Promise<void> {
  try {
    if (!userIds.length) return;
    const sa = bacaAkunLayanan(await bacaRahasia('push.fcm_service_account'));
    if (!sa) return;

    const db = getAdminClient();
    const { data: baris } = await db.from('fcm_tokens').select('token').in('user_id', userIds);
    if (!baris?.length) return;

    const akses = await ambilTokenAkses(sa);
    if (!akses) return;

    const mati: string[] = [];
    await Promise.all(baris.map(async ({ token }: { token: string }) => {
      try {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${akses}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body ?? '' },
              data: { url: payload.url ?? '/dashboard' },
              // Kanal 'notifikasi' dibuat aplikasi dengan bunyi notif.wav.
              android: { priority: 'HIGH', notification: { channel_id: 'notifikasi', sound: 'notif' } },
            },
          }),
        });
        if (r.status === 404 || r.status === 400) {
          const t = await r.text();
          if (/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(t)) mati.push(token);
        }
      } catch { /* gagal sesaat - biarkan */ }
    }));
    if (mati.length) await db.from('fcm_tokens').delete().in('token', mati);
  } catch { /* lihat catatan di atas */ }
}
