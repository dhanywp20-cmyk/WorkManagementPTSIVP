/**
 * lib/monitor.ts - isi /api/monitor: kesehatan dependensi untuk pemantau eksternal (JARVIS "Sentinel").
 *
 * /api/health sengaja tidak menyentuh basis data (publik). Pemantau butuh lebih: apakah DB menjawab,
 * kapan cron terakhir berhasil, berapa galat di layar pengguna. Itu dibuka di sini, BUKAN lewat akun
 * admin dan bukan lewat akses DB langsung dari pemantau:
 * - Wajib `Authorization: Bearer <MONITOR_TOKEN>` (dibandingkan waktu-konstan). Tanpa token yang
 *   cocok -> 401 SEBELUM basis data disentuh, jadi panggilan asing tidak membebani Supabase.
 * - Hanya membaca, tiga query kecil, tanpa efek samping.
 * - Hanya angka & waktu. Tidak ada isi baris: tanpa data pribadi, ticket, insentif, pesan galat,
 *   ringkasan cron, atau token.
 *
 * Batas laju per-IP sengaja tidak dipasang: kodebase belum punya pola batas laju di memori (login
 * memakai tabel login_attempts), dan di serverless Map di memori hanya berlaku per instans. Panggilan
 * tanpa token tidak menyentuh DB; token acak (`openssl rand -hex 32`) tidak bisa ditebak. Bila perlu,
 * pasang aturan Vercel Firewall untuk jalur ini. Cara memasang token: DEPLOYMENT.md -> Pemantauan.
 *
 * Diuji tanpa jaringan: uji/monitor.ts (klien Supabase tiruan).
 */
import { createHash, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KUNCI_CRON_TERAKHIR, type JejakCron } from './cron-catat';
import { CRON_VERCEL } from './kesehatan';

/** Token lebih pendek dari ini dianggap belum dikonfigurasi (endpoint tetap tertutup). */
export const PANJANG_TOKEN_MIN = 32;
/** Query yang macet dihentikan - pemantau butuh jawaban cepat, bukan menunggu batas 30 detik fungsi. */
export const BATAS_QUERY_MS = 5_000;

export interface CronMonitor { last_success_at: string | null; last_run_at: string | null; last_ok: boolean | null }

export interface HasilMonitor {
  /** Sama dengan db.ok: aplikasi jalan DAN basis data menjawab. */
  ok: boolean;
  waktu: string;
  db: { ok: boolean; latency_ms: number };
  /** null = jejak cron tidak terbaca. */
  cron: Record<string, CronMonitor> | null;
  /** Galat di layar pengguna (galat_klien) 24 jam terakhir. null = tidak terbaca / tabel belum ada. */
  errors: { last_24h: number | null };
  version: string | null;
}

const KEPALA = { 'Cache-Control': 'no-store' };

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/**
 * Header Authorization cocok dengan MONITOR_TOKEN? Dibandingkan sebagai SHA-256 lewat timingSafeEqual:
 * panjang sama selalu, jadi waktu jawaban tidak membocorkan isi maupun panjang token.
 */
export function tokenCocok(header: string | null, rahasia: string | undefined): boolean {
  if (!rahasia || rahasia.length < PANJANG_TOKEN_MIN || !header?.startsWith('Bearer ')) return false;
  return timingSafeEqual(sha256(header.slice(7)), sha256(rahasia));
}

/**
 * Jejak cron (app_settings.cron_terakhir) -> bentuk pemantau, hanya untuk cron yang dikenal (CRON_VERCEL):
 * kunci asing tidak ikut, dan `ringkas` (teks hasil / pesan galat) tidak pernah dikirim.
 * last_success_at: `sukses` bila tercatat; untuk jejak lama tanpa `sukses`, waktu jalan terakhir bila ok.
 */
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

/** Tiga bacaan kecil, paralel. Tidak pernah melempar: bagian yang gagal menjadi ok:false / null. */
export async function kumpulkanMonitor(db: SupabaseClient, sekarang = Date.now()): Promise<HasilMonitor> {
  const sinyal = AbortSignal.timeout(BATAS_QUERY_MS);
  const sejak24 = new Date(sekarang - 86_400_000).toISOString();
  const mulai = performance.now();

  const [cek, jejak, galat] = await Promise.all([
    //  HEAD tanpa hitungan: PostgREST tidak mengirim baris apa pun, cukup bukti DB menjawab.
    Promise.resolve(db.from('app_settings').select('key', { head: true }).limit(1).abortSignal(sinyal))
      .then(r => ({ ok: !r.error, ms: Math.round(performance.now() - mulai) }), () => ({ ok: false, ms: Math.round(performance.now() - mulai) })),
    Promise.resolve(db.from('app_settings').select('value').eq('key', KUNCI_CRON_TERAKHIR).abortSignal(sinyal).maybeSingle())
      .then(r => (r.error ? null : bentukCron(((r.data?.value ?? {}) as JejakCron))), () => null),
    //  Jumlah kejadian, sama seperti kartu Kesehatan Sistem (jumlah per baris, baris terakhir terjadi < 24 jam).
    //  Paling banyak BATAS_JENIS_PER_HARI baris per hari, jadi 1000 cukup untuk dua hari.
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

/** Handler GET /api/monitor. `ambilDb` baru dipanggil setelah token lolos. */
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
    //  getAdminClient melempar bila REQUIRE_SERVICE_ROLE menyala tanpa key - itu "DB tidak terjangkau".
    return Response.json({
      ok: false, waktu: new Date().toISOString(), db: { ok: false, latency_ms: 0 }, cron: null, errors: { last_24h: null },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    } satisfies HasilMonitor, { headers: KEPALA });
  }
  return Response.json(await kumpulkanMonitor(db), { headers: KEPALA });
}
