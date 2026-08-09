import { createClient } from '@supabase/supabase-js';

/**
 * Token PostgREST milik user yang sedang login (lihat lib/db-token.ts).
 *
 * Disimpan di module scope + sessionStorage, bukan di React state, karena
 * klien Supabase di bawah adalah singleton yang diimpor oleh ratusan berkas.
 * Menaruhnya di sini membuat seluruh query ikut membawa identitas user tanpa
 * satu pun pemanggilan perlu diubah.
 */
const TOKEN_KEY = 'ivp_db_token';

let dbToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(TOKEN_KEY) : null;

/**
 * Pasang / hapus token. Dipanggil saat login berhasil dan saat sesi
 * dipulihkan dari cookie (lihat lib/auth.ts).
 *
 * Dibaca ulang dari sessionStorage saat modul dimuat supaya query yang jalan
 * paling awal setelah refresh halaman tetap membawa identitas — tanpa itu,
 * query pertama akan berangkat sebagai anonim dan tertolak begitu policy
 * diperketat.
 */
export function setDbToken(token: string | null): void {
  dbToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * fetch yang menyelipkan Authorization pada tiap permintaan.
 *
 * Ini jalur yang didukung resmi (opsi global.fetch) dan satu-satunya cara
 * menyisipkan token yang BERUBAH-UBAH ke klien singleton — opsi global.headers
 * hanya dibaca sekali saat klien dibuat, jadi tidak bisa dipakai di sini.
 *
 * Tanpa token, permintaan berangkat memakai anon key seperti sebelumnya.
 */
const fetchWithToken: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (dbToken) headers.set('Authorization', `Bearer ${dbToken}`);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: fetchWithToken } },
);

// Khusus ticketing — services database (terpisah)
export const supabaseServices = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY!
);
