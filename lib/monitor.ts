import { createHash, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KUNCI_CRON_TERAKHIR, type JejakCron } from './cron-catat';
import { CRON_VERCEL } from './kesehatan';

export const PANJANG_TOKEN_MIN = 32;
export const BATAS_QUERY_MS = 5_000;

export interface CronMonitor { last_success_at: string | null; last_run_at: string | null; last_ok: boolean | null }

export interface HasilMonitor {
  ok: boolean;
  waktu: string;
  db: { ok: boolean; latency_ms: number };
  cron: Record<string, CronMonitor> | null;
  errors: { last_24h: number | null };
  version: string | null;
}

const KEPALA = { 'Cache-Control': 'no-store' };

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

export function tokenCocok(header: string | null, rahasia: string | undefined): boolean {
  if (!rahasia || rahasia.length < PANJANG_TOKEN_MIN || !header?.startsWith('Bearer ')) return false;
  return timingSafeEqual(sha256(header.slice(7)), sha256(rahasia));
}

export function bentukCron(jejak: JejakCron): Record<string, CronMonitor> {
  const hasil: Record<string, CronMonitor> = {};
  for (const { nama } of CRON_VERCEL) {
    const j = jejak[nama];
    hasil[nama] = {
      last_success_at: j?.sukses ?? (j?.ok ? j.waktu : null),
      last_run_at: j?.waktu ?? null,
      last_ok: typeof j?.ok === 'boolean' ? j.ok : null,
    };
  }
  return hasil;
}

export async function kumpulkanMonitor(db: SupabaseClient, sekarang = Date.now()): Promise<HasilMonitor> {
  const sinyal = AbortSignal.timeout(BATAS_QUERY_MS);
  const sejak24 = new Date(sekarang - 86_400_000).toISOString();
  const mulai = performance.now();

  const [cek, jejak, galat] = await Promise.all([
    Promise.resolve(db.from('app_settings').select('key', { head: true }).limit(1).abortSignal(sinyal))
      .then(r => ({ ok: !r.error, ms: Math.round(performance.now() - mulai) }), () => ({ ok: false, ms: Math.round(performance.now() - mulai) })),
    Promise.resolve(db.from('app_settings').select('value').eq('key', KUNCI_CRON_TERAKHIR).abortSignal(sinyal).maybeSingle())
      .then(r => (r.error ? null : bentukCron(((r.data?.value ?? {}) as JejakCron))), () => null),
    Promise.resolve(db.from('galat_klien').select('jumlah').gte('terakhir', sejak24).limit(1000).abortSignal(sinyal))
      .then(r => (r.error ? null : ((r.data ?? []) as { jumlah: number }[]).reduce((n, g) => n + (Number(g.jumlah) || 0), 0)), () => null),
  ]);

  return {
    ok: cek.ok,
    waktu: new Date(sekarang).toISOString(),
    db: { ok: cek.ok, latency_ms: cek.ms },
    cron: jejak,
    errors: { last_24h: galat },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
  };
}

let sudahDiperingatkan = false;

export async function jawabMonitor(request: Request, ambilDb: () => SupabaseClient): Promise<Response> {
  const rahasia = process.env.MONITOR_TOKEN;
  if (!tokenCocok(request.headers.get('authorization'), rahasia)) {
    if (rahasia && rahasia.length < PANJANG_TOKEN_MIN && !sudahDiperingatkan) {
      sudahDiperingatkan = true;
      console.error(`[monitor] MONITOR_TOKEN kurang dari ${PANJANG_TOKEN_MIN} karakter - /api/monitor menolak semua panggilan.`);
    }
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { ...KEPALA, 'WWW-Authenticate': 'Bearer' } });
  }
  let db: SupabaseClient;
  try { db = ambilDb(); } catch {
    return Response.json({
      ok: false, waktu: new Date().toISOString(), db: { ok: false, latency_ms: 0 }, cron: null, errors: { last_24h: null },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    } satisfies HasilMonitor, { headers: KEPALA });
  }
  return Response.json(await kumpulkanMonitor(db), { headers: KEPALA });
}
