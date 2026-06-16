/**
 * lib/auth.ts — Helper auth terpusat
 *
 * Arsitektur session (v2):
 * - Auth TOKEN  → httpOnly cookie (diset oleh /api/auth/login, tidak bisa dibaca JS)
 * - User PROFILE → sessionStorage (bisa dibaca JS, cleared on tab close, bukan localStorage)
 *
 * Keuntungan vs localStorage:
 * - Token tidak bisa dicuri via XSS (httpOnly cookie)
 * - Profile hilang saat browser/tab ditutup (lebih singkat exposure)
 * - Cookie expired = session otomatis invalid di server
 */

import { SESSION_DURATION_MS } from './constants';

const SS_USER = 'ivp_user';
const SS_TIME = 'ivp_login_time';

/**
 * Set session setelah login berhasil.
 * Token sudah diset sebagai httpOnly cookie oleh API route /api/auth/login.
 * Di sini kita hanya simpan profile user di sessionStorage untuk akses sync.
 */
export function setSession(userData: object): void {
  const now = Date.now();
  sessionStorage.setItem(SS_USER, JSON.stringify(userData));
  sessionStorage.setItem(SS_TIME, String(now));
}

/**
 * Hapus session (logout).
 * Hapus profile dari sessionStorage + invalidate httpOnly cookie via API.
 */
export function clearSession(): void {
  sessionStorage.removeItem(SS_USER);
  sessionStorage.removeItem(SS_TIME);
  // Fire-and-forget: invalidate cookie di server
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

/**
 * Baca session dari sessionStorage (sync, fast).
 * Mengembalikan null jika tidak ada atau sudah expired.
 * Untuk verifikasi dari cookie: gunakan verifySessionFromCookie().
 */
export function getSession<T = Record<string, unknown>>(): T | null {
  try {
    const saved = sessionStorage.getItem(SS_USER);
    const savedTime = sessionStorage.getItem(SS_TIME);
    if (!saved) return null;
    if (savedTime) {
      const elapsed = Date.now() - parseInt(savedTime, 10);
      if (elapsed > SESSION_DURATION_MS) {
        clearSession();
        return null;
      }
    }
    return JSON.parse(saved) as T;
  } catch {
    return null;
  }
}

/**
 * Verifikasi session dari httpOnly cookie (async).
 * Digunakan saat sessionStorage kosong (refresh halaman).
 * Mengembalikan user data jika cookie valid, null jika tidak.
 */
export async function verifySessionFromCookie<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) return null;
    const { user } = await res.json();
    if (user) {
      // Re-populate sessionStorage dari cookie yang valid
      setSession(user);
    }
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Cek session dan redirect ke dashboard jika expired.
 * Mengembalikan true jika session masih valid.
 */
export function checkSessionOrRedirect(): boolean {
  const user = getSession();
  if (!user) {
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
    return false;
  }
  return true;
}

/**
 * Setup interval cek session (tiap 60 detik).
 * Kembalikan cleanup function untuk dipakai di useEffect return.
 */
export function startSessionWatcher(): () => void {
  const interval = setInterval(() => {
    checkSessionOrRedirect();
  }, 60_000);
  return () => clearInterval(interval);
}
