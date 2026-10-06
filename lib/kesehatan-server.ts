/**
 * lib/kesehatan-server.ts - pengumpul data Kesehatan Sistem (service role) + alert Telegram admin.
 * Dipakai route /api/admin/kesehatan (halaman) dan cron escalate & digest (alert otomatis).
 * Hanya sisi server - jangan di-import dari komponen klien.
 */
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { bacaRahasia } from '@/lib/rahasia-server';
import { KUNCI_CRON_TERAKHIR, type JejakCron } from '@/lib/cron-catat';
import { ringkasKesehatan, type DataKesehatan, type Peringatan } from '@/lib/kesehatan';

export async function kumpulkanKesehatan(db: SupabaseClient): Promise<DataKesehatan> {
  const sejak24 = new Date(Date.now() - 86_400_000).toISOString();
  const sejak7h = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [rpc, jejak, ai24, ai7, wa24, rilis, pengaturan] = await Promise.all([
    db.rpc('kesehatan_sistem'),
    db.from('app_settings').select('value').eq('key', KUNCI_CRON_TERAKHIR).maybeSingle(),
    db.from('ai_pakai_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak24),
    db.from('ai_pakai_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak7h),
    db.from('wa_kirim_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak24),
    db.from('rilis_android').select('versi, diunggah_pada').order('diunggah_pada', { ascending: false }).limit(1),
    bacaPengaturan(true).catch(() => null),
  ]);
  return {
    sistem: rpc.error ? null : (rpc.data as DataKesehatan['sistem']),
    sqlBelum: !!rpc.error,
    cronVercel: ((jejak.data?.value ?? {}) as JejakCron),
    ai: { jam24: ai24.count ?? 0, hari7: ai7.count ?? 0 },
    waJam24: wa24.count ?? 0,
    apkTerakhir: rilis.data?.[0] ?? null,
    kanal: pengaturan?.aktif ?? null,
    env: { serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY, cronSecret: !!process.env.CRON_SECRET },
  };
}

export const KUNCI_ALERT_TERAKHIR = 'kesehatan_alert_terakhir';
/** Peringatan yang sama tidak dikirim ulang dalam rentang ini (cron escalate & digest sama-sama memeriksa). */
export const JEDA_ALERT_JAM = 20;

/** Isi pesan alert dari daftar peringatan merah. */
export function pesanAlert(merah: Peringatan[]): string {
  return [
    `🚨 Kesehatan Sistem Work Management: ${merah.length} peringatan merah`,
    '',
    ...merah.map((p, i) => `${i + 1}. ${p.teks}`),
    '',
    'Buka Admin Panel -> Sistem -> Kesehatan Sistem untuk detailnya.',
  ].join('\n');
}

/** Sidik isi peringatan - alert dikirim ulang bila isinya berubah, atau setelah JEDA_ALERT_JAM. */
export const sidikPeringatan = (merah: Peringatan[]) =>
  createHash('sha1').update(merah.map(p => p.teks).join('\n')).digest('hex').slice(0, 16);

/** Perlu kirim? Isi berubah, atau yang sama tapi sudah > JEDA_ALERT_JAM jam sejak kirim terakhir. */
export function perluKirimAlert(sidik: string, terakhir: { sidik: string; waktu: string } | null, sekarang: number): boolean {
  if (!terakhir) return true;
  if (terakhir.sidik !== sidik) return true;
  return sekarang - new Date(terakhir.waktu).getTime() > JEDA_ALERT_JAM * 3_600_000;
}

/**
 * Periksa kesehatan; bila ada peringatan MERAH, kirim ke Telegram semua admin / pemegang Full
 * Access yang sudah menautkan Telegram. Dipanggil di akhir cron (gagalnya tidak boleh
 * menggagalkan cron itu sendiri).
 */
export async function kirimAlertKesehatan(db: SupabaseClient): Promise<{ merah: number; terkirim: number; alasan?: string }> {
  try {
    const data = await kumpulkanKesehatan(db);
    const merah = ringkasKesehatan(data, Date.now()).filter(p => p.tingkat === 'merah');
    if (!merah.length) return { merah: 0, terkirim: 0 };

    const sidik = sidikPeringatan(merah);
    const { data: baris } = await db.from('app_settings').select('value').eq('key', KUNCI_ALERT_TERAKHIR).maybeSingle();
    const terakhir = (baris?.value ?? null) as { sidik: string; waktu: string } | null;
    if (!perluKirimAlert(sidik, terakhir, Date.now())) return { merah: merah.length, terkirim: 0, alasan: 'sudah dikirim' };

    const [token, pengaturan] = await Promise.all([bacaRahasia('telegram.bot_token'), bacaPengaturan()]);
    if (!token || !pengaturan.aktif.telegram) return { merah: merah.length, terkirim: 0, alasan: 'Telegram belum aktif' };

    const { data: admin } = await db.from('users').select('telegram_chat_id')
      .or('role.in.(admin,superadmin),access_level.eq.full').not('telegram_chat_id', 'is', null);
    const tujuan = Array.from(new Set(((admin ?? []) as { telegram_chat_id: string | null }[]).map(a => a.telegram_chat_id).filter((x): x is string => !!x)));
    if (!tujuan.length) return { merah: merah.length, terkirim: 0, alasan: 'tidak ada admin dengan Telegram tertaut' };

    let terkirim = 0;
    const teks = pesanAlert(merah);
    for (const chat of tujuan) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: teks }),
        });
        if ((await r.json().catch(() => ({})))?.ok) terkirim++;
      } catch { /* satu chat gagal tidak menghentikan yang lain */ }
    }
    if (terkirim) await db.from('app_settings').upsert({ key: KUNCI_ALERT_TERAKHIR, value: { sidik, waktu: new Date().toISOString() } }, { onConflict: 'key' });
    return { merah: merah.length, terkirim };
  } catch (e) {
    return { merah: -1, terkirim: 0, alasan: (e as Error).message };
  }
}
