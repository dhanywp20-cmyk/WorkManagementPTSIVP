/**
 * lib/efek-server.ts - EfekSamping sisi SERVER (DIWAYPI). HANYA server.
 *
 * Padanan dari efekPeramban, langkah demi langkah:
 *   wa    - batas kirim yang sama dengan /api/notifikasi/whatsapp/kirim (wa_kirim_log atas
 *           nama pelaku), saklar induk & per-event yang sama (lib/wa.ts), penyedia yang
 *           sama (kirimWA), plus salinan Telegram lewat kirimTelegramKeNomorServer.
 *   inApp - baris notifications yang sama dengan createNotification, lalu push langsung
 *           (kirimPushKeUser) - di peramban push lewat /api/push/send.
 *   audit - baris audit_trail yang sama dengan logAudit, ditandai "via DIWAYPI".
 *
 * `db` = klien SEBAGAI pelaku (RLS berlaku, sama dengan peramban); `admin` hanya untuk
 * wa_kirim_log (tabel itu memang ditulis service role oleh route kirim).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWA } from '@/lib/wa';
import { kirimWA } from '@/lib/wa-kirim-server';
import { kirimTelegramKeNomorServer } from '@/lib/telegram-server';
import { kirimPushKeUser } from '@/lib/web-push-server';
import { ambilJatahWA } from '@/lib/wa-batas';
import type { EfekSamping } from '@/lib/efek-samping';

export const PENANDA_DIWAYPI = 'via DIWAYPI';

export function buatEfekServer(db: SupabaseClient, admin: SupabaseClient, pelakuId: string): EfekSamping {
  return {
    async wa(target, pesan, event) {
      try {
        const ditolak = await ambilJatahWA(admin, pelakuId, target);
        if (ditolak) return { ok: false, reason: ditolak };
        return await sendWA(target, pesan, 'reminder_wa', event, { wa: kirimWA, telegram: kirimTelegramKeNomorServer });
      } catch {
        return { ok: false, reason: 'network error' };
      }
    },
    async inApp(p) {
      try {
        const { error } = await db.from('notifications').insert([{
          user_id: p.user_id, type: p.type, title: p.title, body: p.body ?? null,
          action_url: p.action_url ?? null, ref_id: p.ref_id ?? null, created_by: p.created_by ?? null,
          is_read: false, created_at: new Date().toISOString(),
        }]);
        if (error) { console.warn('[efek-server] notifikasi:', error.message); return; }
        await kirimPushKeUser([p.user_id], { title: p.title, body: p.body, url: p.action_url });
      } catch (e) {
        console.warn('[efek-server] notifikasi gagal:', e);
      }
    },
    async audit(p) {
      try {
        await db.from('audit_trail').insert([{
          user_id: p.user_id, user_name: p.user_name, action: p.action, module: p.module,
          target_id: p.target_id ?? null, target_name: p.target_name ?? null,
          old_value: p.old_value ?? null, new_value: p.new_value ?? null,
          notes: p.notes ? `${p.notes} · ${PENANDA_DIWAYPI}` : PENANDA_DIWAYPI,
          created_at: new Date().toISOString(),
        }]);
      } catch { /* audit tidak boleh menggagalkan aksi (sama dengan logAudit) */ }
    },
  };
}
