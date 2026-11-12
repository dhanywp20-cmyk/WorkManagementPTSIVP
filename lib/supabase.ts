import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { periksaJawabanTulis } from './galat/tulis';
import { denganUnggahTahan } from './unggah-tahan';

const TOKEN_KEY = 'ivp_db_token';

let dbToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(TOKEN_KEY) : null;

export function setDbToken(token: string | null): void {
  dbToken = token;
  pasangTokenRealtime(token);
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

function pasangTokenRealtime(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    supabase.realtime.setAuth(token);
  } catch {
  }
}

export function getDbToken(): string | null {
  return dbToken;
}

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

let pembaruanBerjalan: Promise<void> | null = null;

export const SESI_HABIS = 'ivp:sesi-habis';

export function refreshDbToken(): Promise<void> {
  if (pembaruanBerjalan) return pembaruanBerjalan;
  pembaruanBerjalan = (async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.status === 401) { window.dispatchEvent(new Event(SESI_HABIS)); return; }
      if (!res.ok) return;
      const { db_token } = await res.json();
      if (db_token) setDbToken(db_token);
    } catch {
    } finally {
      pembaruanBerjalan = null;
    }
  })();
  return pembaruanBerjalan;
}

const fetchWithToken: typeof fetch = async (input, init) => {
  if (dbToken) {
    const exp = dbTokenExpiryMs();
    if (exp !== null && exp - Date.now() < 60_000) await refreshDbToken();
  }
  const headers = new Headers(init?.headers);
  if (dbToken) headers.set('Authorization', `Bearer ${dbToken}`);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const jawaban = await fetch(input, { ...init, headers });
    void periksaJawabanTulis(init?.method, url, jawaban);
    return jawaban;
  } catch (galat) {
    if (!(galat instanceof Error && galat.name === 'AbortError')) void periksaJawabanTulis(init?.method, url, null);
    throw galat;
  }
};

async function tokenAkses(): Promise<string | null> {
  if (dbToken) {
    const exp = dbTokenExpiryMs();
    if (exp !== null && exp - Date.now() < 60_000) await refreshDbToken();
  }
  return dbToken;
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { accessToken: tokenAkses, global: { fetch: denganUnggahTahan(fetchWithToken) } },
);

pasangTokenRealtime(dbToken);

const JEDA_SERVICES_PUTUS_MS = 60_000;
const BATAS_TUNGGU_SERVICES_MS = 8_000;
let servicesPutusSampai = 0;

function galatServices(sebab: unknown): Error {
  const g = new Error(`Basis data Services tidak terjangkau${sebab instanceof Error ? ` (${sebab.message})` : ''}`);
  g.name = 'ServicesTakTerjangkau';
  (g as Error & { code: string }).code = 'ABORT_ERR';
  return g;
}

function sinyalDenganBatas(asal: AbortSignal | null | undefined): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') return asal ?? undefined;
  const batas = AbortSignal.timeout(BATAS_TUNGGU_SERVICES_MS);
  if (!asal) return batas;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([asal, batas]) : asal;
}

const fetchServices: typeof fetch = async (input, init) => {
  if (Date.now() < servicesPutusSampai) throw galatServices(null);
  const sinyal = sinyalDenganBatas(init?.signal);
  try {
    return await fetch(input, { ...init, signal: sinyal });
  } catch (galat) {
    if (init?.signal?.aborted) throw galat;
    servicesPutusSampai = Date.now() + JEDA_SERVICES_PUTUS_MS;
    throw galatServices(galat);
  }
};

export const supabaseServices = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY!,
  { global: { fetch: denganUnggahTahan(fetchServices) } },
);

export function periksaKonfigurasiServices(): {
  urlSama: boolean;
  servicesBelumDiset: boolean;
} {
  const utama = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const svc = process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ?? '';
  return {
    urlSama: !!utama && !!svc && utama === svc,
    servicesBelumDiset: !svc || !process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY,
  };
}

if (process.env.NODE_ENV !== 'production') {
  const cek = periksaKonfigurasiServices();
  if (cek.servicesBelumDiset) {
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_SERVICES_URL / ANON_KEY belum di-set — ' +
      'seluruh alur Team Services di Ticketing akan gagal.',
    );
  } else if (cek.urlSama) {
    console.warn(
      '[supabase] URL basis data utama dan Services SAMA. Di lokal ini normal, ' +
      'tapi artinya mirror ticket ke Services DB tidak benar-benar menyeberang. ' +
      'Pastikan di produksi keduanya berbeda.',
    );
  }
}
