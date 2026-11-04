
import { supabase } from '@/lib/supabase';
import { KATALOG_EVENT } from './katalog';
import type { PenyediaWA } from './penyedia-wa';

export type Kanal = 'in_app' | 'whatsapp' | 'telegram';

export const KANAL: { key: Kanal; label: string; warna: string }[] = [
  { key: 'in_app',   label: 'In-App',   warna: '#0891b2' },
  { key: 'whatsapp', label: 'WhatsApp', warna: '#16a34a' },
  { key: 'telegram', label: 'Telegram', warna: '#0088cc' },
];

export interface PengaturanNotifikasi {
  aktif: Record<Kanal, boolean>;
  telegramChatId: string;
  perEvent: Record<string, Kanal[]>;
  waPenyedia: PenyediaWA;
  waConfig: Record<string, string>;
}

const KUNCI = 'notifikasi.kanal';

export const BAWAAN: PengaturanNotifikasi = {
  aktif: { in_app: true, whatsapp: true, telegram: false },
  telegramChatId: '',
  perEvent: {},
  waPenyedia: 'fonnte',
  waConfig: {},
};

export function kanalUntuk(eventKey: string, p: PengaturanNotifikasi): Kanal[] {
  const dari = p.perEvent[eventKey]
    ?? (KATALOG_EVENT.find(e => e.key === eventKey)?.bawaanKanal as Kanal[] | undefined)
    ?? [];
  return dari.filter(k => p.aktif[k]);
}

let cache: PengaturanNotifikasi | null = null;

export async function bacaPengaturan(paksa = false): Promise<PengaturanNotifikasi> {
  if (cache && !paksa) return cache;
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', KUNCI).maybeSingle();
    if (data?.value) {
      const j = JSON.parse(data.value) as Partial<PengaturanNotifikasi>;
      cache = {
        aktif: { ...BAWAAN.aktif, ...(j.aktif ?? {}) },
        telegramChatId: j.telegramChatId ?? '',
        perEvent: j.perEvent ?? {},
        waPenyedia: j.waPenyedia ?? BAWAAN.waPenyedia,
        waConfig: j.waConfig ?? {},
      };
      return cache;
    }
  } catch {  }
  cache = { ...BAWAAN };
  return cache;
}

export async function simpanPengaturan(p: PengaturanNotifikasi): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const { error } = await supabase.from('app_settings')
      .upsert({ key: KUNCI, value: JSON.stringify(p) }, { onConflict: 'key' });
    if (error) return { ok: false, pesan: error.message };
    cache = p;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, pesan: e?.message ?? 'gagal menyimpan' };
  }
}
