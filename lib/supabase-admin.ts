import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * lib/supabase-admin.ts - Supabase client KHUSUS server (route handler).
 *
 * Memakai SERVICE_ROLE key untuk operasi tepercaya di server: baca hash
 * password, kelola session, kelola akun. Tanpa key itu client jatuh ke ANON
 * key, dan route yang mengira dirinya melewati RLS sebenarnya berjalan sebagai
 * anon tanpa satu pun galat. Keadaan itu dicatat ke log server, dan
 * REQUIRE_SERVICE_ROLE=1 mengubahnya jadi galat keras - pasang setelah key
 * terkonfigurasi supaya deploy berikutnya yang kehilangan key langsung gagal.
 *
 * JANGAN diimpor dari komponen klien.
 */
let cached: SupabaseClient | null = null;
let sudahDiperingatkan = false;

/** True bila SERVICE_ROLE key sudah dikonfigurasi (lockdown RLS aman dijalankan). */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** True bila operator sudah menyalakan mode ketat lewat REQUIRE_SERVICE_ROLE. */
export function serviceRoleWajib(): boolean {
  const v = (process.env.REQUIRE_SERVICE_ROLE ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    if (serviceRoleWajib()) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY tidak ada padahal REQUIRE_SERVICE_ROLE menyala. ' +
        'Route server menolak berjalan sebagai anon. Pasang key-nya lalu deploy ulang.',
      );
    }
    if (!sudahDiperingatkan) {
      sudahDiperingatkan = true;
      console.error(
        '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY belum di-set — route server ' +
        'berjalan memakai ANON key dan TIDAK melewati RLS. Pasang key-nya, lalu ' +
        'set REQUIRE_SERVICE_ROLE=1 supaya kondisi ini tidak terulang diam-diam.',
      );
    }
  }

  cached = createClient(url, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
