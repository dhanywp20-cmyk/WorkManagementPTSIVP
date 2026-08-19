import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * lib/supabase-services-admin.ts - client basis data Services untuk sisi SERVER.
 *
 * Basis data Services milik organisasi lain (lintas divisi & lintas kantor).
 * Sebagian isinya - nomor telepon admin mereka, misalnya - tidak ada urusannya
 * dengan siapa pun yang membuka platform ini, jadi pembacaannya dikerjakan di
 * server dan hasilnya tidak pernah dikirim ke browser.
 *
 * Memakai SUPABASE_SERVICES_SERVICE_ROLE_KEY bila ada; kalau belum diset,
 * jatuh ke anon key seperti perilaku sebelumnya supaya alur yang sedang
 * berjalan tidak berubah.
 *
 * JANGAN diimpor dari komponen klien.
 */
let cached: SupabaseClient | null = null;

export function getServicesAdminClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL;
  const key =
    process.env.SUPABASE_SERVICES_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
