/**
 * lib/notifikasi/pengaturan.ts - kanal mana yang aktif untuk tiap event.
 *
 * Sebelum berkas ini, jawabannya dipaku di `bawaanKanal` tiap event
 * (lib/notifikasi/katalog.ts) dan hanya bisa diubah dengan menyunting kode
 * lalu deploy ulang. Sekarang admin mengaturnya dari Admin Panel ->
 * Integrations, tersimpan di app_settings.
 *
 * ── YANG SENGAJA TIDAK DISIMPAN DI SINI ────────────────────────────────────
 *
 * TOKEN. Bukan kelalaian, melainkan aturan yang ditegakkan basis data:
 * app_settings punya trigger `tolak_rahasia_di_pengaturan()` yang MENOLAK
 * setiap kunci yang namanya mengandung token/secret/api_key/password/
 * credential (lihat sql/pengaturan-merek.sql). Trigger itu dipasang setelah
 * token gateway WhatsApp ditemukan tersimpan di sana dalam bentuk terbaca -
 * dan app_settings dibaca oleh siapa pun yang memegang anon key.
 *
 * Jadi token Fonnte tetap di secret Supabase Edge Function, dan token bot
 * Telegram ikut aturan yang sama (variabel lingkungan TELEGRAM_BOT_TOKEN di
 * sisi server). Yang boleh tinggal di app_settings hanyalah hal yang tidak
 * memberi akses kalau bocor: nyala/mati, chat id tujuan, dan matriks
 * event -> kanal.
 */

import { supabase } from '@/lib/supabase';
import { KATALOG_EVENT } from './katalog';

export type Kanal = 'in_app' | 'whatsapp' | 'telegram';

export const KANAL: { key: Kanal; label: string; warna: string }[] = [
  { key: 'in_app',   label: 'In-App',   warna: '#0891b2' },
  { key: 'whatsapp', label: 'WhatsApp', warna: '#16a34a' },
  { key: 'telegram', label: 'Telegram', warna: '#0088cc' },
];

export interface PengaturanNotifikasi {
  /** Saklar induk per kanal. Mati = event apa pun tidak lewat kanal itu. */
  aktif: Record<Kanal, boolean>;
  /** Tujuan bawaan Telegram (id chat / grup). Bukan rahasia - hanya alamat. */
  telegramChatId: string;
  /** event key -> daftar kanal. Yang tidak tercantum memakai bawaanKanal. */
  perEvent: Record<string, Kanal[]>;
}

const KUNCI = 'notifikasi.kanal';

export const BAWAAN: PengaturanNotifikasi = {
  //  in_app & whatsapp menyala supaya perilaku platform TIDAK berubah saat
  //  berkas ini pertama kali dipasang - keduanya memang sudah berjalan.
  //  telegram mati: belum ada token, menyalakannya hanya akan menghasilkan
  //  kegagalan diam-diam di setiap pengiriman.
  aktif: { in_app: true, whatsapp: true, telegram: false },
  telegramChatId: '',
  perEvent: {},
};

/** Kanal yang berlaku untuk sebuah event, sesudah saklar induk diterapkan. */
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
        //  Digabung dengan BAWAAN, bukan dipakai mentah: kalau kelak ada kanal
        //  baru, baris tersimpan yang belum mengenalnya tidak membuat
        //  p.aktif[kanalBaru] jadi undefined - yang akan terbaca sebagai mati
        //  di satu tempat dan meledak di tempat lain.
        aktif: { ...BAWAAN.aktif, ...(j.aktif ?? {}) },
        telegramChatId: j.telegramChatId ?? '',
        perEvent: j.perEvent ?? {},
      };
      return cache;
    }
  } catch { /* diam - jatuh ke bawaan */ }
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
