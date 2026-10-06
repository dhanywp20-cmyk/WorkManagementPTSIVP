/**
 * lib/cron-catat.ts - jejak "terakhir jalan" cron Vercel (escalate, digest) di
 * app_settings.cron_terakhir, dibaca Admin Panel -> Sistem -> Kesehatan Sistem.
 *
 * Kenapa perlu: cron yang diam-diam tidak bekerja tidak memberi tanda apa pun. Eskalasi
 * ticket pernah tidak jalan berbulan-bulan (klien anon tanpa login membaca 0 ticket) tanpa
 * ada yang tahu. Dengan jejak ini, "terakhir jalan" + ringkasan hasilnya terlihat.
 *
 * Isinya hanya waktu & angka ringkas - tidak ada rahasia (app_settings terbaca anon).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const KUNCI_CRON_TERAKHIR = 'cron_terakhir';
export type JejakCron = Record<string, { waktu: string; ok: boolean; ringkas: string }>;

export async function catatCron(db: SupabaseClient, nama: string, ok: boolean, ringkas: string): Promise<void> {
  try {
    const { data } = await db.from('app_settings').select('value').eq('key', KUNCI_CRON_TERAKHIR).maybeSingle();
    const lama = (data?.value && typeof data.value === 'object' ? data.value : {}) as JejakCron;
    const baru: JejakCron = { ...lama, [nama]: { waktu: new Date().toISOString(), ok, ringkas: ringkas.slice(0, 200) } };
    await db.from('app_settings').upsert({ key: KUNCI_CRON_TERAKHIR, value: baru }, { onConflict: 'key' });
  } catch { /* jejak gagal ditulis tidak boleh menggagalkan cron-nya */ }
}
