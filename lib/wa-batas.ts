/**
 * lib/wa-batas.ts - batas kirim WA per akun (tabel wa_kirim_log, migrasi 018). HANYA server.
 *
 * Dipakai /api/notifikasi/whatsapp/kirim (peramban) DAN lib/efek-server.ts (DIWAYPI),
 * supaya token integrasi tidak menjadi jalan pintas di luar batas yang sama.
 * Satu aksi kerja bisa memicu beberapa WA sekaligus, jadi batas per menit longgar;
 * yang dicegah adalah pemakaian sebagai alat blast / spam ke satu nomor.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const BATAS_PER_MENIT = 60;
export const BATAS_PER_HARI = 600;
export const BATAS_TARGET_PER_MENIT = 6;

/** null = boleh kirim (dan sudah dicatat di wa_kirim_log); string = alasan ditolak. */
export async function ambilJatahWA(db: SupabaseClient, userId: string, targetMentah: string): Promise<string | null> {
  const target = String(targetMentah ?? '').replace(/\D/g, '');
  const sejak = (ms: number) => new Date(Date.now() - ms).toISOString();
  const hitung = (kolom: 'user_id' | 'target', nilai: string, ms: number) =>
    db.from('wa_kirim_log').select('id', { count: 'exact', head: true })
      .eq(kolom, nilai).gte('created_at', sejak(ms));
  const [menit, hari, keTarget] = await Promise.all([
    hitung('user_id', userId, 60_000),
    hitung('user_id', userId, 86_400_000),
    hitung('target', target, 60_000),
  ]);
  if ((menit.count ?? 0) >= BATAS_PER_MENIT || (hari.count ?? 0) >= BATAS_PER_HARI
      || (keTarget.count ?? 0) >= BATAS_TARGET_PER_MENIT) {
    return 'Terlalu banyak pengiriman WA. Coba lagi sebentar lagi.';
  }
  await db.from('wa_kirim_log').insert({ user_id: userId, target });
  return null;
}
