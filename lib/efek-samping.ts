/**
 * lib/efek-samping.ts - efek berantai sebuah aksi kerja, sebagai PARAMETER.
 *
 * Logika "tiket Solved", "ubah status jadwal", dan "buat jadwal" (lib/tiket-selesai.ts,
 * lib/jadwal-status.ts, lib/jadwal-buat.ts) dulu tertulis di hook peramban dan memanggil
 * sendWA / createNotification / logAudit langsung - fungsi-fungsi yang hanya bekerja di
 * peramban (URL relatif, klien Supabase bersesi). Kini modul itu menerima efeknya dari
 * pemanggil:
 *   - peramban: efekPeramban (lib/efek-peramban.ts) = persis fungsi lama;
 *   - server (DIWAYPI): buatEfekServer (lib/efek-server.ts) = padanan server-nya.
 * Isi pesan, penerima, dan urutannya tetap satu sumber.
 *
 * Ketiganya TIDAK PERNAH melempar - kegagalan kabar tidak boleh membatalkan pekerjaannya.
 */
import type { NotifPayload } from '@/lib/notifications';
import type { AuditPayload } from '@/lib/audit';

export interface EfekSamping {
  /** WA (+ salinan Telegram) - sama dengan sendWA(target, pesan, 'reminder_wa', event). */
  wa(target: string, pesan: string, event?: string): Promise<{ ok: boolean; reason?: string }>;
  /** Notifikasi in-app (+ push) - sama dengan createNotification. */
  inApp(p: NotifPayload): Promise<void>;
  /** Audit trail - sama dengan logAudit. */
  audit(p: AuditPayload): Promise<void>;
}

/** Pelaku aksi (akun yang menekan tombol / pemilik token DIWAYPI). */
export interface Pelaku {
  id: string;
  username: string;
  full_name: string;
}
