import { setDbToken, dbTokenExpiryMs, refreshDbToken } from './supabase';

import { SESSION_DURATION_MS } from './constants';

const SS_USER = 'ivp_user';
const SS_TIME = 'ivp_login_time';

export function setSession(userData: object): void {
  const now = Date.now();
  let data = userData as Record<string, unknown>;
  const DIPERTAHANKAN = ['pimpinan', 'access_level', 'piket_akses'] as const;
  if (DIPERTAHANKAN.some(k => !(k in data))) {
    try {
      const lama = JSON.parse(sessionStorage.getItem(SS_USER) ?? 'null') as Record<string, unknown> | null;
      if (lama && lama.id === data.id) {
        const tambahan: Record<string, unknown> = {};
        for (const k of DIPERTAHANKAN) if (!(k in data) && k in lama) tambahan[k] = lama[k];
        if ('pimpinan' in tambahan && tambahan.pimpinan !== true) delete tambahan.pimpinan;
        data = { ...data, ...tambahan };
      }
    } catch {  }
  }
  sessionStorage.setItem(SS_USER, JSON.stringify(data));
  sessionStorage.setItem(SS_TIME, String(now));
}

export function clearSession(): void {
  sessionStorage.removeItem(SS_USER);
  sessionStorage.removeItem(SS_TIME);
  setDbToken(null);
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

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

export async function verifySessionFromCookie<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) return null;
    const { user, db_token } = await res.json();
    if (user) {
      setSession(user);
      setDbToken(db_token ?? null);
    }
    return user ?? null;
  } catch {
    return null;
  }
}

export async function cekSesiServer(): Promise<'sah' | 'habis' | 'gagal'> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (res.status === 401) return 'habis';
    if (!res.ok) return 'gagal';
    const { user, db_token } = await res.json();
    if (!user) return 'habis';
    if (db_token) setDbToken(db_token);
    return 'sah';
  } catch {
    return 'gagal';
  }
}

export function checkSessionOrRedirect(): boolean {
  const user = getSession();
  if (!user) {
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
    return false;
  }
  return true;
}

export async function refreshDbTokenIfNeeded(ambangMenit = 30): Promise<void> {
  const exp = dbTokenExpiryMs();
  if (exp === null) return;
  if (exp - Date.now() > ambangMenit * 60_000) return;
  await refreshDbToken();
}

export function startSessionWatcher(): () => void {
  void refreshDbTokenIfNeeded();
  const interval = setInterval(() => {
    if (!checkSessionOrRedirect()) return;
    void refreshDbTokenIfNeeded();
  }, 60_000);
  return () => clearInterval(interval);
}
