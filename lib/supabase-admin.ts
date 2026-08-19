import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * lib/supabase-admin.ts — Supabase client KHUSUS server (route handler).
 *
 * Memakai SERVICE_ROLE key bila tersedia → bypass RLS untuk operasi tepercaya
 * di server (baca hash password, kelola session, dll) tanpa membuka tabel
 * sensitif ke anon key yang ikut ter-bundle di browser.
 *
 * Bila SUPABASE_SERVICE_ROLE_KEY belum di-set, client jatuh ke ANON key. Itu
 * bukan sekadar "kurang optimal": route yang mengira dirinya melewati RLS
 * sebenarnya berjalan sebagai anon, dan turunnya hak itu terjadi TANPA satu
 * pun galat. Maka:
 *
 *   1. Keadaan itu dicatat sekali ke log server (terbaca di Vercel), bukan
 *      didiamkan.
 *   2. REQUIRE_SERVICE_ROLE=1 mengubahnya jadi galat keras. Dipasang setelah
 *      key benar-benar terkonfigurasi, supaya key yang hilang di deploy
 *      berikutnya ketahuan seketika, bukan diam-diam turun jadi anon.
 *
 * Bawaannya tetap fallback agar deployment yang sedang berjalan tidak mati
 * mendadak hanya karena berkas ini berubah.
 *
 * JANGAN diimpor dari komponen klien — hanya untuk kode server.
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
