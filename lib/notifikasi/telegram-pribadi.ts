
import { bacaPengaturan } from './pengaturan';
import { supabase } from '../supabase';

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

export function normalkanNomor(v: string | null | undefined): string {
  const angka = (v ?? '').replace(/\D/g, '');
  if (!angka) return '';
  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('0')) return `62${angka.slice(1)}`;
  return angka;
}

let peta: Map<string, string> | null = null;
let petaSampai = 0;

export async function lupakanPetaTelegram(): Promise<void> {
  peta = null; petaSampai = 0;
}

export async function chatIdDariNomor(nomor: string | null | undefined): Promise<string | null> {
  const kunci = normalkanNomor(nomor);
  if (!kunci) return null;

  if (!peta || Date.now() > petaSampai) {
    try {
      const { data, error } = await supabase.from('users')
        .select('phone_number, telegram_chat_id')
        .not('telegram_chat_id', 'is', null);
      if (error) return null;
      const baru = new Map<string, string>();
      for (const u of (data ?? []) as { phone_number: string | null; telegram_chat_id: string | null }[]) {
        const n = normalkanNomor(u.phone_number);
        if (n && u.telegram_chat_id) baru.set(n, u.telegram_chat_id);
      }
      peta = baru;
      petaSampai = Date.now() + 60_000;
    } catch {
      return null;
    }
  }
  return peta.get(kunci) ?? null;
}

export async function kirimTelegramKeNomor(
  nomor: string | null | undefined,
  pesan: string,
): Promise<{ ok: boolean; alasan?: string }> {
  const chatId = await chatIdDariNomor(nomor);
  if (!chatId) return { ok: false, alasan: 'nomor ini belum menghubungkan Telegram' };
  return kirimTelegramPribadi(chatId, pesan);
}
