/**
 * lib/notifikasi/router.ts - satu jalur untuk seluruh notifikasi.
 *
 *     EVENT  ->  ROUTER  ->  KANAL (in-app, WhatsApp, ...)
 *
 * kirimNotifikasi() dipanggil SEKALI per kejadian bisnis; router yang
 * memutuskan kanal mana yang aktif untuk event itu dan memanggil provider
 * masing-masing. Pemanggilnya tidak perlu tahu ada berapa kanal atau
 * bagaimana tiap kanal bekerja.
 *
 * STATUS: infrastruktur ini BARU, dan BELUM dipakai satu pun dari 48 titik
 * pengiriman WhatsApp yang sudah ada (tersebar di ticketing, reminder-
 * schedule, form-require-project). Itu keputusan sadar, bukan belum sempat:
 *
 *   - Ketiga berkas itu berjalan di produksi dan dipakai tim setiap hari.
 *   - Saya tidak punya cara memverifikasi pengiriman WhatsApp sungguhan dari
 *     lingkungan ini - tidak ada token Fonnte produksi, tidak ada cara
 *     melihat apakah pesan benar-benar sampai.
 *   - Salah satu dari 48 titik itu diam-diam berhenti mengirim berarti
 *     seseorang tidak tahu ada tiket untuknya, bukan sekadar tampilan yang
 *     kurang rapi.
 *
 *   Memindahkan seluruhnya sekaligus tanpa cara menguji akibatnya adalah
 *   persis peringatan Anda sendiri: "jangan sampai ada error... platform ini
 *   sudah saya pakai untuk workflow team saya."
 *
 * Yang SUDAH dipakai infrastruktur ini: pemberitahuan admin di
 * /api/auth/register (lihat migrasinya di sana) - satu titik yang saya
 * tulis sendiri hari ini, jadi perilakunya saya pastikan sama persis
 * sebelum dan sesudah pindah.
 *
 * Migrasi 48 titik yang lama menyusul BERTAHAP, satu per satu, dengan
 * perbandingan pesan sebelum/sesudah setiap kali - bukan sekaligus.
 */

import { bacaPengaturan, kanalUntuk, type Kanal } from './pengaturan';
import { createNotification, type NotifPayload } from '@/lib/notifications';
import { sendWA } from '@/lib/wa';

export type PenerimaWA = { nama: string; telepon: string | null | undefined };

export interface PermintaanNotifikasi {
  /** Kunci di KATALOG_EVENT - lihat lib/notifikasi/katalog.ts. */
  event: string;
  /** Isi untuk kanal in-app. Dilewati kalau event ini tidak memakai in-app. */
  inApp?: Omit<NotifPayload, 'type'> & { type?: NotifPayload['type'] };
  /** Isi untuk kanal WhatsApp. Dilewati kalau event ini tidak memakai WhatsApp. */
  whatsapp?: { penerima: PenerimaWA[]; pesan: string; jenisWA?: string };
  /**
   * Isi untuk kanal Telegram. `chatId` boleh dikosongkan - kalau begitu
   * dipakai tujuan bawaan dari Admin Panel. Kalau keduanya kosong, kanal ini
   * dilewati diam-diam, bukan dianggap gagal: belum diatur bukan kesalahan.
   */
  telegram?: { pesan: string; chatId?: string };
}

export interface HasilNotifikasi {
  inApp: { dicoba: boolean; error?: string };
  whatsapp: { dicoba: number; gagal: number };
  telegram: { dicoba: boolean; error?: string };
}

/**
 * Kanal yang aktif untuk satu event - kini dari pengaturan Admin Panel,
 * bukan lagi hanya bawaan di katalog. Kalau pengaturannya belum pernah
 * disimpan, kanalUntuk() jatuh balik ke bawaanKanal, jadi perilakunya sama
 * persis seperti sebelum berkas pengaturan ada.
 */
async function kanalAktif(eventKey: string): Promise<Kanal[]> {
  return kanalUntuk(eventKey, await bacaPengaturan());
}

/**
 * Kirim satu notifikasi lewat seluruh kanal yang aktif untuk event-nya.
 *
 * Tidak pernah melempar galat - notifikasi yang gagal tidak boleh
 * menggagalkan alur bisnis yang memicunya (persis prinsip lib/wa.ts).
 * Kegagalan dilaporkan lewat nilai baliknya, bukan exception, supaya
 * pemanggil yang peduli bisa memeriksa tanpa try/catch.
 */
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
    //  Tujuan: yang disebut pemanggil, kalau tidak ada pakai bawaan Admin
    //  Panel. Kalau dua-duanya kosong, lewati - tanpa mencatat kegagalan.
    const chatId = req.telegram.chatId || (await bacaPengaturan()).telegramChatId;
    if (chatId) {
      hasil.telegram.dicoba = true;
      try {
        //  Lewat route server, BUKAN api.telegram.org langsung: tokennya tidak
        //  boleh sampai ke peramban. Lihat app/api/notifikasi/telegram/route.ts.
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
