import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * lib/supabase-admin.ts — Supabase client KHUSUS server (route handler).
 *
 * Memakai SERVICE_ROLE key bila tersedia → bypass RLS untuk operasi tepercaya
 * di server (baca hash password, kelola session, dll) tanpa membuka tabel
 * sensitif ke anon key yang ikut ter-bundle di browser.
 *
 * Fallback ke ANON key bila SUPABASE_SERVICE_ROLE_KEY belum di-set, sehingga
 * perilaku TETAP IDENTIK dengan sebelumnya sampai env var dipasang. Artinya
 * mengganti createClient(...anon) → getAdminClient() di route server tidak
 * mengubah apa pun sampai key service-role benar-benar dikonfigurasi.
 *
 * JANGAN diimpor dari komponen klien — hanya untuk kode server.
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** True bila SERVICE_ROLE key sudah dikonfigurasi (lockdown RLS aman dijalankan). */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
