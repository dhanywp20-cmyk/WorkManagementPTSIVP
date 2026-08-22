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

import { cariEvent } from './katalog';
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
}

export interface HasilNotifikasi {
  inApp: { dicoba: boolean; error?: string };
  whatsapp: { dicoba: number; gagal: number };
}

/**
 * Kanal yang aktif untuk satu event.
 *
 * Sekarang hanya membaca bawaanKanal dari katalog. Titik sambung untuk
 * Phase 6 (Admin Panel -> Notifications, per-event override) ada di sini:
 * baca dulu pengaturan tersimpan, jatuh balik ke bawaan kalau belum ada.
 */
function kanalAktif(eventKey: string): Array<'in_app' | 'whatsapp'> {
  return cariEvent(eventKey)?.bawaanKanal ?? ['in_app', 'whatsapp'];
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
  const kanal = kanalAktif(req.event);
  const hasil: HasilNotifikasi = { inApp: { dicoba: false }, whatsapp: { dicoba: 0, gagal: 0 } };

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

  return hasil;
}
