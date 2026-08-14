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

/** Token yang sedang dipakai — dibaca pemantau sesi untuk tahu kapan harus diperbarui. */
export function getDbToken(): string | null {
  return dbToken;
}

/**
 * Kapan token kedaluwarsa (epoch ms), dibaca dari klaim `exp`.
 *
 * Payload JWT hanya di-base64, jadi bisa dibaca tanpa rahasia apa pun. Yang
 * dibaca di sini SEMATA waktu kedaluwarsa untuk menjadwalkan pembaruan —
 * keabsahan tanda tangannya tetap diverifikasi PostgREST di server, bukan di
 * sini. Mengembalikan null bila token tidak ada atau bentuknya tak terbaca.
 */
export function dbTokenExpiryMs(): number | null {
  if (!dbToken) return null;
  try {
    const payload = dbToken.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
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
/**
 * Perbarui token dari /api/auth/session (yang menerbitkan token baru selama
 * cookie sesi masih sah). Dipakai dua tempat: penjaga di fetchWithToken bawah,
 * dan pemantau sesi berkala di lib/auth.ts.
 *
 * Tinggal di berkas INI, bukan di lib/auth.ts, supaya fetchWithToken bisa
 * memakainya tanpa impor melingkar (auth.ts sudah mengimpor berkas ini).
 */
let pembaruanBerjalan: Promise<void> | null = null;

export function refreshDbToken(): Promise<void> {
  // Satu pembaruan pada satu waktu: tanpa ini, sepuluh query yang berangkat
  // bersamaan akan memicu sepuluh panggilan /api/auth/session sekaligus.
  if (pembaruanBerjalan) return pembaruanBerjalan;
  pembaruanBerjalan = (async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (!res.ok) return;
      const { db_token } = await res.json();
      if (db_token) setDbToken(db_token);
    } catch {
      /* jaringan bermasalah — biarkan, percobaan berikutnya akan mencoba lagi */
    } finally {
      pembaruanBerjalan = null;
    }
  })();
  return pembaruanBerjalan;
}

/**
 * fetch yang menyelipkan Authorization pada tiap permintaan.
 *
 * Ini jalur yang didukung resmi (opsi global.fetch) dan satu-satunya cara
 * menyisipkan token yang BERUBAH-UBAH ke klien singleton — opsi global.headers
 * hanya dibaca sekali saat klien dibuat, jadi tidak bisa dipakai di sini.
 *
 * Sebelum mengirim, token yang sudah lewat batas waktu DIPERBARUI dulu.
 * Tanpa ini, token basi tetap dikirim dan PostgREST menolak setiap query
 * dengan galat JWT — termasuk saat membuat ticket — padahal dari sisi user
 * tidak ada tanda apa pun bahwa sesinya bermasalah. Penjagaannya diletakkan
 * di sini, bukan di tiap halaman, karena hanya sebagian halaman yang memasang
 * pemantau sesi; di lapisan ini SEMUA modul ikut terlindungi.
 *
 * Tanpa token sama sekali, permintaan berangkat memakai anon key seperti dulu.
 */
const fetchWithToken: typeof fetch = async (input, init) => {
  if (dbToken) {
    const exp = dbTokenExpiryMs();
    // Ambang 60 detik: menutup kemungkinan token kedaluwarsa persis saat
    // permintaan sedang di jalan.
    if (exp !== null && exp - Date.now() < 60_000) await refreshDbToken();
  }
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
