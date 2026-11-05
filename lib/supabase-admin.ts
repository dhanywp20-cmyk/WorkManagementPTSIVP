import { createClient, SupabaseClient } from '@supabase/supabase-js';

function fetchTanpaCache(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' });
}
let cached: SupabaseClient | null = null;
let sudahDiperingatkan = false;

export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

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
