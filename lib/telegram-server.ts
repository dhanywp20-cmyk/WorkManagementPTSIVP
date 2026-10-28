/**
 * lib/telegram-server.ts - kirim salinan Telegram ke pemilik sebuah NOMOR, dari SERVER.
 * HANYA untuk sisi server (membaca token bot lewat bacaRahasia).
 *
 * Padanan server dari kirimTelegramKeNomor (lib/telegram-pribadi.ts). Versi peramban
 * menembak /api/notifikasi/telegram dengan URL relatif - di server itu gagal diam-diam,
 * jadi aksi yang dijalankan dari server (DIWAYPI) kehilangan salinan Telegram-nya.
 * Langkahnya sama: kanal Telegram harus menyala, nomor dinormalkan lalu dipetakan ke
 * telegram_chat_id, kirim teks polos (tanpa parse_mode - lihat route Telegram).
 */
import { bacaRahasia } from '@/lib/rahasia-server';
import { getAdminClient } from '@/lib/supabase-admin';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { normalkanNomor } from '@/lib/telegram-pribadi';

export async function kirimTelegramKeNomorServer(nomor: string, pesan: string): Promise<{ ok: boolean; alasan?: string }> {
  const kunci = normalkanNomor(nomor);
  if (!kunci || !pesan.trim()) return { ok: false, alasan: 'nomor/pesan kosong' };
  try {
    const p = await bacaPengaturan();
    if (!p.aktif.telegram) return { ok: false, alasan: 'kanal Telegram nonaktif di Admin Panel' };
    const { data, error } = await getAdminClient().from('users')
      .select('phone_number, telegram_chat_id').not('telegram_chat_id', 'is', null);
    if (error) return { ok: false, alasan: error.message };
    const chatId = ((data ?? []) as { phone_number: string | null; telegram_chat_id: string | null }[])
      .find(u => normalkanNomor(u.phone_number) === kunci)?.telegram_chat_id;
    if (!chatId) return { ok: false, alasan: 'nomor ini belum menghubungkan Telegram' };
    const token = await bacaRahasia('telegram.bot_token');
    if (!token) return { ok: false, alasan: 'token bot Telegram belum diisi' };
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: pesan.trim() }),
    });
    const j = await r.json() as { ok?: boolean; description?: string };
    return j?.ok ? { ok: true } : { ok: false, alasan: j?.description ?? 'Telegram menolak pesan.' };
  } catch (e) {
    return { ok: false, alasan: e instanceof Error ? e.message : String(e) };
  }
}
