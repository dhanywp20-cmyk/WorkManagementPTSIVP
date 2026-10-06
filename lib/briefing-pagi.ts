/**
 * lib/briefing-pagi.ts - pengaturan "Briefing Pagi" (cron /api/cron/digest, 06:00 WIB) yang
 * bisa dinyalakan / dimatikan admin dari Admin Panel -> Integrations.
 *
 * Disimpan di app_settings (kunci `briefing_pagi`, jsonb). Tulis hanya bisa admin (fungsi DB
 * boleh_tulis_pengaturan), baca terbuka - isinya hanya dua saklar, bukan rahasia.
 *
 * Murni (tanpa jaringan) di bagian rapikan - diuji di uji/briefing-pagi.ts.
 */

export const KUNCI_BRIEFING = 'briefing_pagi';

export interface PengaturanBriefing {
  /** Saklar utama: mati = cron digest tidak mengirim apa pun (WA, Telegram, push). */
  aktif: boolean;
  /** Pengingat Daily Report yang belum diisi (ke anggota) + blok "Tim Anda belum mengisi" (ke atasan). */
  pengingatDailyReport: boolean;
}

/** Bawaan = perilaku sebelum ada saklar: semuanya menyala. */
export const BRIEFING_BAWAAN: PengaturanBriefing = { aktif: true, pengingatDailyReport: true };

/** Nilai tersimpan -> pengaturan sah. Kunci hilang / tidak sah = bawaan (menyala), bukan mati. */
export function rapikanBriefing(nilai: unknown): PengaturanBriefing {
  let o: unknown = nilai;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = (o && typeof o === 'object' && !Array.isArray(o) ? o : {}) as Record<string, unknown>;
  return {
    aktif: typeof r.aktif === 'boolean' ? r.aktif : BRIEFING_BAWAAN.aktif,
    pengingatDailyReport: typeof r.pengingatDailyReport === 'boolean' ? r.pengingatDailyReport : BRIEFING_BAWAAN.pengingatDailyReport,
  };
}
