'use client';

/**
 * lib/push-client.ts - sisi peramban dari push notification asli.
 * Lihat lib/web-push-server.ts & app/api/push/* untuk sisi server.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Daftarkan service worker - aman dipanggil berkali-kali (browser dedupe sendiri). */
export async function daftarSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export function pushDidukung(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function statusIzinNotif(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

let cachedKey: { key: string; sampai: number } | null = null;
const UMUR_KUNCI_MS = 5 * 60_000;

async function ambilVapidPublicKey(): Promise<string | null> {
  const kini = Date.now();
  if (cachedKey && cachedKey.sampai > kini) return cachedKey.key;
  try {
    const r = await fetch('/api/push/vapid-public-key');
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.publicKey) return null;
    cachedKey = { key: j.publicKey, sampai: kini + UMUR_KUNCI_MS };
    return j.publicKey as string;
  } catch {
    return null;
  }
}

/** Sudah berlangganan push di PERANGKAT INI (browser ini)? */
export async function sudahBerlanggananPush(): Promise<boolean> {
  if (!pushDidukung()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** Minta izin (kalau belum diputuskan) lalu daftarkan perangkat ini untuk menerima push. */
export async function aktifkanPushNotif(): Promise<{ ok: boolean; alasan?: string }> {
  if (!pushDidukung()) return { ok: false, alasan: 'Peramban ini tidak mendukung push notification.' };

  let izin = Notification.permission;
  if (izin === 'default') izin = await Notification.requestPermission();
  if (izin !== 'granted') {
    return { ok: false, alasan: 'Izin notifikasi ditolak. Aktifkan lewat pengaturan peramban/HP untuk situs ini, lalu coba lagi.' };
  }

  const reg = await daftarSW();
  if (!reg) return { ok: false, alasan: 'Gagal mendaftarkan service worker.' };
  await navigator.serviceWorker.ready;

  const publicKey = await ambilVapidPublicKey();
  if (!publicKey) return { ok: false, alasan: 'Push notification belum diaktifkan admin (Admin Panel → Integrations).' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (e: any) {
      return { ok: false, alasan: 'Gagal berlangganan push: ' + (e?.message ?? 'tidak diketahui') };
    }
  }

  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, userAgent: navigator.userAgent }),
    });
    const res = await r.json();
    if (!res.ok) return { ok: false, alasan: res.alasan ?? 'Gagal menyimpan pendaftaran perangkat.' };
  } catch {
    return { ok: false, alasan: 'Jaringan bermasalah saat menyimpan pendaftaran.' };
  }
  return { ok: true };
}

/** Matikan push di perangkat ini. */
export async function matikanPushNotif(): Promise<void> {
  if (!pushDidukung()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => { /* abaikan - baris DB yatim dibersihkan otomatis saat push berikutnya gagal 410 */ });
      await sub.unsubscribe();
    }
  } catch { /* abaikan */ }
}
