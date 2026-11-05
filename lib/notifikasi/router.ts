
import { bacaPengaturan, kanalUntuk, type Kanal } from './pengaturan';
import { createNotification, type NotifPayload } from '@/lib/notifications';
import { sendWA } from '@/lib/wa';

export type PenerimaWA = { nama: string; telepon: string | null | undefined };

export interface PermintaanNotifikasi {
  event: string;
  inApp?: Omit<NotifPayload, 'type'> & { type?: NotifPayload['type'] };
  whatsapp?: { penerima: PenerimaWA[]; pesan: string; jenisWA?: string };
  telegram?: { pesan: string; chatId?: string };
}

export interface HasilNotifikasi {
  inApp: { dicoba: boolean; error?: string };
  whatsapp: { dicoba: number; gagal: number };
  telegram: { dicoba: boolean; error?: string };
}

async function kanalAktif(eventKey: string): Promise<Kanal[]> {
  return kanalUntuk(eventKey, await bacaPengaturan());
}

export async function kirimNotifikasi(req: PermintaanNotifikasi): Promise<HasilNotifikasi> {
  const kanal = await kanalAktif(req.event);
  const hasil: HasilNotifikasi = {
    inApp: { dicoba: false }, whatsapp: { dicoba: 0, gagal: 0 }, telegram: { dicoba: false },
  };

  if (kanal.includes('in_app') && req.inApp) {
    hasil.inApp.dicoba = true;
    try {
      await createNotification({ type: 'system', ...req.inApp });
    } catch (e) {
      hasil.inApp.error = e instanceof Error ? e.message : String(e);
    }
  }

  if (kanal.includes('whatsapp') && req.whatsapp) {
    const penerimaSah = req.whatsapp.penerima.filter(p => !!p.telepon);
    hasil.whatsapp.dicoba = penerimaSah.length;
    const kirimSemua = await Promise.allSettled(
      penerimaSah.map(p => sendWA(p.telepon as string, req.whatsapp!.pesan, req.whatsapp!.jenisWA ?? 'reminder_wa')),
    );
    hasil.whatsapp.gagal = kirimSemua.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
  }

  if (kanal.includes('telegram') && req.telegram) {
    const chatId = req.telegram.chatId || (await bacaPengaturan()).telegramChatId;
    if (chatId) {
      hasil.telegram.dicoba = true;
      try {
        const r = await fetch('/api/notifikasi/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, pesan: req.telegram.pesan }),
        });
        const j = await r.json() as { ok?: boolean; alasan?: string };
        if (!j?.ok) hasil.telegram.error = j?.alasan ?? 'gagal kirim';
      } catch (e) {
        hasil.telegram.error = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return hasil;
}
