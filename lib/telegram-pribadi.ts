/**
 * lib/telegram-pribadi.ts - kirim notifikasi Telegram ke SATU orang tertentu.
 *
 * Beda dari lib/notifikasi/router.ts (yang mengirim ke SATU tujuan bersama
 * yang diatur admin di Admin Panel - grup tim atau chat admin), berkas ini
 * mengirim ke Chat ID pribadi seseorang, hasil ia menghubungkan akun
 * Telegram-nya sendiri lewat profilnya (lihat
 * app/api/notifikasi/telegram/route.ts aksi 'hubungkan').
 *
 * Dipanggil BERDAMPINGAN dengan pengiriman WhatsApp yang sudah ada, bukan
 * menggantikannya - kalau orangnya belum menghubungkan Telegram, ini cukup
 * diam saja (bukan kegagalan; "belum diatur" bukan kesalahan, sama seperti
 * nomor WA kosong).
 */

import { bacaPengaturan } from './notifikasi/pengaturan';

export async function kirimTelegramPribadi(
  chatId: string | null | undefined,
  pesan: string,
): Promise<{ ok: boolean; alasan?: string }> {
  if (!chatId) return { ok: false, alasan: 'belum menghubungkan Telegram' };

  const p = await bacaPengaturan();
  if (!p.aktif.telegram) return { ok: false, alasan: 'kanal Telegram nonaktif di Admin Panel' };

  try {
    const r = await fetch('/api/notifikasi/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, pesan }),
    });
    const j = await r.json() as { ok?: boolean; alasan?: string };
    return { ok: !!j?.ok, alasan: j?.alasan };
  } catch (e) {
    return { ok: false, alasan: e instanceof Error ? e.message : String(e) };
  }
}
