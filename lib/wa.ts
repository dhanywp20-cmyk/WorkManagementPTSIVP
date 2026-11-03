
import { bacaPengaturan, kanalUntuk } from '@/lib/notifikasi/pengaturan';
import { kirimTelegramKeNomor } from '@/lib/telegram-pribadi';

async function waMenyala(): Promise<boolean> {
  try {
    return (await bacaPengaturan()).aktif.whatsapp !== false;
  } catch {
    return true;
  }
}

type PengirimServer = (target: string, pesan: string) => Promise<{ ok: boolean; alasan?: string }>;
let pengirimServer: PengirimServer | null = null;
export function pasangPengirimServer(fn: PengirimServer) { pengirimServer = fn; }

export interface JalurKirim {
  wa?: PengirimServer;
  telegram?: (nomor: string, pesan: string) => Promise<{ ok: boolean; alasan?: string }>;
}

async function kirimLewatPenyedia(
  body: Record<string, unknown>,
  jalur?: JalurKirim,
): Promise<{ ok?: boolean; reason?: string }> {
  const target = String(body.target ?? '');
  const message = String(body.message ?? '');
  const pengirim = jalur?.wa ?? pengirimServer;
  if (jalur?.wa || typeof window === 'undefined') {
    if (!pengirim) return { ok: false, reason: 'pengirim WA server belum dipasang (import lib/wa-server)' };
    const h = await pengirim(target, message);
    return { ok: h.ok, reason: h.alasan };
  }
  const res = await fetch('/api/notifikasi/whatsapp/kirim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message }),
  });
  return await res.json() as { ok?: boolean; reason?: string };
}

async function kanalBerlaku(event?: string): Promise<{ wa: boolean; tg: boolean } | null> {
  if (!event) return null;
  try {
    const p = await bacaPengaturan();
    const kanal = kanalUntuk(event, p);
    return {
      wa: kanal.includes('whatsapp') && p.aktif.whatsapp !== false,
      tg: kanal.includes('telegram') && p.aktif.telegram !== false,
    };
  } catch {
    return null;
  }
}

async function kirimDuaKanal(
  target: string,
  message: string,
  type: string,
  event?: string,
  jalur?: JalurKirim,
): Promise<{ ok: boolean; reason?: string }> {
  const berlaku = await kanalBerlaku(event);

  let tg: Promise<unknown> | null = null;
  if (!berlaku || berlaku.tg) {
    tg = (jalur?.telegram ?? kirimTelegramKeNomor)(target, message).catch(() => {  });
  }
  const tungguTg = async <T,>(h: T): Promise<T> => { if (jalur?.telegram && tg) await tg; return h; };

  if (berlaku && !berlaku.wa) {
    return tungguTg({ ok: false, reason: `kanal WhatsApp dimatikan admin untuk kejadian ${event}` });
  }
  if (!(await waMenyala())) return tungguTg({ ok: false, reason: 'kanal WhatsApp dimatikan admin' });
  const data = await kirimLewatPenyedia({ type, target, message }, jalur);
  return tungguTg({ ok: data?.ok === true, reason: data?.reason });
}

export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    await kirimDuaKanal(
      String(body.target ?? ''),
      String(body.message ?? ''),
      String(body.type ?? 'reminder_wa'),
      typeof body.event === 'string' ? body.event : undefined,
    );
  } catch {
  }
}

export async function sendWA(
  target: string,
  message: string,
  type = 'reminder_wa',
  event?: string,
  jalur?: JalurKirim,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await kirimDuaKanal(target, message, type, event, jalur);
  } catch {
    return { ok: false, reason: 'network error' };
  }
}
