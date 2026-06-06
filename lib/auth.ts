/**
 * lib/auth.ts — Helper auth terpusat
 * Dipakai di semua halaman login untuk set/clear session secara konsisten.
 */

import { SESSION_DURATION_MS } from './constants';

const SESSION_COOKIE = 'ivp_session';
const LS_USER = 'currentUser';
const LS_TIME = 'loginTime';

/**
 * Set session setelah login berhasil.
 * Menyimpan user di localStorage DAN cookie (untuk middleware).
 */
export function setSession(userData: object): void {
  const now = Date.now();
  // localStorage — untuk dibaca komponen client
  localStorage.setItem(LS_USER, JSON.stringify(userData));
  localStorage.setItem(LS_TIME, String(now));
  // Cookie — untuk dibaca middleware Edge (session marker, bukan data user)
  // max-age dalam detik
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Hapus session (logout).
 */
export function clearSession(): void {
  localStorage.removeItem(LS_USER);
  localStorage.removeItem(LS_TIME);
  // Hapus cookie dengan max-age=0
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Baca session dari localStorage.
 * Mengembalikan null jika tidak ada atau sudah expired.
 */
export function getSession<T = Record<string, unknown>>(): T | null {
  try {
    const saved = localStorage.getItem(LS_USER);
    const savedTime = localStorage.getItem(LS_TIME);
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
 * Cek session dan redirect ke dashboard jika expired.
 * Panggil ini di useEffect pada setiap halaman yang embedded via iframe.
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
