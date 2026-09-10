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
 *
 * BUG SERIUS YANG DIPERBAIKI DI SINI - fetch dipaksa 'no-store'.
 *
 * Next.js App Router menimpa `fetch()` global dan meng-cache hasilnya secara
 * DEFAULT, kecuali panggilan fetch itu sendiri menyatakan cache:'no-store'.
 * `export const dynamic = 'force-dynamic'` di route TIDAK cukup mematikan ini -
 * itu cuma mencegah route-nya sendiri dirender statis, bukan mematikan cache
 * pada fetch() di DALAMNYA. supabase-js memanggil fetch() di baliknya tanpa
 * opsi cache apa pun, jadi Next.js membekukan hasil kueri PERTAMA untuk URL
 * (=kondisi kueri) yang sama, dan tidak pernah menyegarkannya lagi sampai
 * deploy baru.
 *
 * Ini nyata terjadi: /api/learning-center/rank membaca lc_quiz_attempts dan
 * users TANPA filter per-pemanggil (URL-nya sama untuk semua orang), jadi
 * begitu satu orang membukanya, SEMUA ORANG SETELAHNYA mendapat daftar yang
 * dibekukan di momen itu - peserta baru yang mendaftar/submit SESUDAHNYA tidak
 * pernah muncul, walau datanya benar di database dan fungsi peringkatnya
 * sendiri benar. Bug yang sama membuat /api/admin/kode-acara menampilkan akun
 * yang sudah dihapus: daftarnya dibekukan sebelum penghapusan terjadi.
 *
 * Diperbaiki dengan memasang `fetch` khusus lewat opsi `global.fetch` supabase-
 * js, yang menambahkan cache:'no-store' ke SETIAP panggilan REST yang dibuat
 * client ini - bukan cuma dua route yang kebetulan ketahuan, tapi SEMUA route
 * yang memakai getAdminClient().
 */
function fetchTanpaCache(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' });
}
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
    global: { fetch: fetchTanpaCache },
  });
  return cached;
}
