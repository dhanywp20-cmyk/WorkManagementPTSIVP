/**
 * uji/monitor.ts - /api/monitor untuk pemantau eksternal (JARVIS Sentinel): token, bentuk jawaban, dan
 * tidak ada isi baris yang bocor. Klien Supabase tiruan - tidak ada jaringan.
 *
 * Jalankan: npm test -- monitor
 */
import { readFileSync } from 'fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tokenCocok, bentukCron, jawabMonitor, kumpulkanMonitor, PANJANG_TOKEN_MIN } from '../lib/monitor';
import { catatCron, type JejakCron } from '../lib/cron-catat';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

interface Kueri { tabel: string; kolom: string; head: boolean; filter: string[]; batas?: number; sinyal: boolean; satu: boolean; upsert?: unknown }
type Hasil = { data?: unknown; error?: unknown };

/** Pembangun query tiruan: mencatat apa yang diminta, menjawab lewat `jawab`. */
function klienTiruan(jawab: (q: Kueri) => Hasil | Promise<Hasil>) {
  const kueri: Kueri[] = [];
  const db = {
    from(tabel: string) {
      const q: Kueri = { tabel, kolom: '', head: false, filter: [], sinyal: false, satu: false };
      kueri.push(q);
      const b = {
        select(kolom: string, opsi?: { head?: boolean }) { q.kolom = kolom; q.head = !!opsi?.head; return b; },
        eq(k: string, v: string) { q.filter.push(`${k}=eq.${v}`); return b; },
        gte(k: string, v: string) { q.filter.push(`${k}=gte.${v}`); return b; },
        limit(n: number) { q.batas = n; return b; },
        abortSignal() { q.sinyal = true; return b; },
        maybeSingle() { q.satu = true; return b; },
        upsert(v: unknown) { q.upsert = v; return b; },
        then<A, B>(ok: (h: Hasil) => A, tolak?: (e: unknown) => B) { return Promise.resolve().then(() => jawab(q)).then(ok, tolak); },
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, kueri };
}

const TOKEN = 'a'.repeat(64);
const sekarang = Date.parse('2026-10-17T03:00:00Z');
const jamLalu = (j: number) => new Date(sekarang - j * 3_600_000).toISOString();

const JEJAK: JejakCron = {
  escalate: { waktu: jamLalu(2), ok: true, ringkas: '3 ticket dieskalasi', sukses: jamLalu(2) },
  digest: { waktu: jamLalu(4), ok: false, ringkas: 'Fonnte timeout untuk 0812xxxx', sukses: jamLalu(28) },
  cron_asing: { waktu: jamLalu(1), ok: true, ringkas: 'rahasia' },
};
const GALAT = [
  { jumlah: 3, pesan: 'TypeError: nama pelanggan PT Contoh', jalur: '/ticketing/123' },
  { jumlah: 2, pesan: 'x', jalur: null },
];

/** Jawaban normal: DB hidup, jejak cron ada, dua jenis galat. */
const jawabSehat = (q: Kueri): Hasil => {
  if (q.tabel === 'app_settings' && q.head) return { data: null, error: null };
  if (q.tabel === 'app_settings') return { data: { value: JEJAK }, error: null };
  if (q.tabel === 'galat_klien') return { data: GALAT, error: null };
  return { data: null, error: { message: `tabel tak terduga: ${q.tabel}` } };
};

const permintaan = (auth?: string) => new Request('https://contoh.test/api/monitor', { headers: auth ? { authorization: auth } : {} });

async function main() {
  console.log('\n1. Token dibandingkan waktu-konstan, wajib cukup panjang');
  cek('token benar -> cocok', tokenCocok(`Bearer ${TOKEN}`, TOKEN));
  cek('token salah -> tidak', !tokenCocok(`Bearer ${'b'.repeat(64)}`, TOKEN));
  cek('token beda panjang -> tidak (tanpa galat panjang)', !tokenCocok(`Bearer ${TOKEN}x`, TOKEN) && !tokenCocok('Bearer a', TOKEN));
  cek('tanpa header -> tidak', !tokenCocok(null, TOKEN));
  cek('tanpa awalan "Bearer " -> tidak', !tokenCocok(TOKEN, TOKEN) && !tokenCocok(`Basic ${TOKEN}`, TOKEN));
  cek('MONITOR_TOKEN kosong -> selalu tidak', !tokenCocok('Bearer ', '') && !tokenCocok('Bearer x', undefined));
  const pendek = 'p'.repeat(PANJANG_TOKEN_MIN - 1);
  cek(`MONITOR_TOKEN < ${PANJANG_TOKEN_MIN} karakter -> tertutup walau cocok`, !tokenCocok(`Bearer ${pendek}`, pendek));

  console.log('\n2. Jawaban 401 tanpa token - basis data tidak disentuh');
  process.env.MONITOR_TOKEN = TOKEN;
  let dipanggil = 0;
  const ambilTerhitung = () => { dipanggil++; return klienTiruan(jawabSehat).db; };
  for (const [nama, auth] of [['tanpa header', undefined], ['token salah', `Bearer ${'z'.repeat(64)}`], ['skema salah', `Token ${TOKEN}`]] as const) {
    const r = await jawabMonitor(permintaan(auth), ambilTerhitung);
    const isi = await r.json();
    cek(`${nama} -> 401 no-store`, r.status === 401 && r.headers.get('cache-control') === 'no-store' && isi.error === 'Unauthorized');
  }
  delete process.env.MONITOR_TOKEN;
  const tanpaEnv = await jawabMonitor(permintaan(`Bearer ${TOKEN}`), ambilTerhitung);
  cek('MONITOR_TOKEN belum diisi -> 401', tanpaEnv.status === 401);
  cek('klien DB tidak pernah dibuat untuk panggilan yang ditolak', dipanggil === 0);

  console.log('\n3. Jawaban 200 dengan token - bentuk & isi');
  process.env.MONITOR_TOKEN = TOKEN;
  process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
  const { db, kueri } = klienTiruan(jawabSehat);
  const r = await jawabMonitor(permintaan(`Bearer ${TOKEN}`), () => db);
  const teks = await r.text();
  const isi = JSON.parse(teks);
  cek('status 200, JSON, no-store', r.status === 200 && (r.headers.get('content-type') ?? '').includes('application/json') && r.headers.get('cache-control') === 'no-store');
  cek('kunci tingkat atas persis ok, waktu, db, cron, errors, version',
    JSON.stringify(Object.keys(isi)) === JSON.stringify(['ok', 'waktu', 'db', 'cron', 'errors', 'version']), Object.keys(isi).join(','));
  cek('ok & db.ok true, latency_ms angka >= 0', isi.ok === true && isi.db.ok === true && typeof isi.db.latency_ms === 'number' && isi.db.latency_ms >= 0);
  cek('waktu ISO', !Number.isNaN(Date.parse(isi.waktu)));
  cek('version = 7 karakter SHA', isi.version === '0123456');
  cek('cron hanya escalate & digest (kunci asing dibuang)', JSON.stringify(Object.keys(isi.cron)) === JSON.stringify(['escalate', 'digest']));
  cek('escalate: sukses terakhir = jalan terakhir', isi.cron.escalate.last_success_at === jamLalu(2) && isi.cron.escalate.last_ok === true);
  cek('digest gagal: last_ok false, last_success_at tetap waktu sukses sebelumnya',
    isi.cron.digest.last_ok === false && isi.cron.digest.last_run_at === jamLalu(4) && isi.cron.digest.last_success_at === jamLalu(28));
  cek('errors.last_24h = jumlah kejadian (3 + 2)', isi.errors.last_24h === 5);
  cek('tidak ada isi baris di jawaban (ringkas cron, pesan/jalur galat, nomor)',
    !/ringkas|dieskalasi|Fonnte|0812|TypeError|PT Contoh|ticketing|rahasia|pesan|jalur/.test(teks), teks);
  cek('jawaban kecil (< 600 byte)', teks.length < 600, String(teks.length));

  console.log('\n4. Query yang dijalankan: baca-saja, kolom minimal, ada batas waktu');
  const [q1, q2, q3] = kueri;
  cek('tepat 3 query', kueri.length === 3, kueri.map(k => k.tabel).join(','));
  cek('cek DB = HEAD app_settings limit 1 (tanpa baris)', q1.tabel === 'app_settings' && q1.head && q1.batas === 1);
  cek('jejak cron = app_settings.value key=cron_terakhir', q2.tabel === 'app_settings' && q2.kolom === 'value' && q2.filter.includes('key=eq.cron_terakhir') && q2.satu);
  cek('galat = hanya kolom jumlah, 24 jam terakhir, dibatasi', q3.tabel === 'galat_klien' && q3.kolom === 'jumlah' && q3.filter.some(f => f.startsWith('terakhir=gte.')) && (q3.batas ?? 0) > 0);
  cek('semua query membawa abortSignal', kueri.every(k => k.sinyal));
  cek('tidak ada penulisan', kueri.every(k => k.upsert === undefined));
  const sejak = q3.filter.find(f => f.startsWith('terakhir=gte.'))!.slice('terakhir=gte.'.length);
  const selisih = Date.now() - Date.parse(sejak);
  cek('jendela galat ~24 jam', Math.abs(selisih - 86_400_000) < 60_000, sejak);

  console.log('\n5. DB bermasalah -> ok:false, bagian lain null, tetap 200');
  const mati = await kumpulkanMonitor(klienTiruan(() => ({ data: null, error: { message: 'connection refused' } })).db, sekarang);
  cek('galat PostgREST -> ok false, cron null, errors null', mati.ok === false && mati.db.ok === false && mati.cron === null && mati.errors.last_24h === null);
  const lempar = await kumpulkanMonitor(klienTiruan(() => { throw new Error('fetch failed'); }).db, sekarang);
  cek('query melempar (jaringan/timeout) -> ditangani, tidak melempar', lempar.ok === false && lempar.cron === null && lempar.errors.last_24h === null);
  const tanpaTabel = await kumpulkanMonitor(klienTiruan(q => (q.tabel === 'galat_klien' ? { error: { code: '42P01' } } : jawabSehat(q))).db, sekarang);
  cek('tabel galat_klien belum ada -> errors null, DB tetap ok', tanpaTabel.ok === true && tanpaTabel.errors.last_24h === null && tanpaTabel.cron !== null);
  const kosong = await kumpulkanMonitor(klienTiruan(q => (q.tabel === 'app_settings' && !q.head ? { data: null, error: null } : jawabSehat(q))).db, sekarang);
  cek('jejak cron belum ada -> tiap cron null semua', kosong.cron?.escalate.last_run_at === null && kosong.cron?.digest.last_success_at === null && kosong.cron?.digest.last_ok === null);
  const tanpaKlien = await jawabMonitor(permintaan(`Bearer ${TOKEN}`), () => { throw new Error('REQUIRE_SERVICE_ROLE'); });
  const isiTanpaKlien = await tanpaKlien.json();
  cek('klien gagal dibuat -> 200 ok:false', tanpaKlien.status === 200 && isiTanpaKlien.ok === false && isiTanpaKlien.db.ok === false);
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  cek('tanpa VERCEL_GIT_COMMIT_SHA -> version null', (await kumpulkanMonitor(klienTiruan(jawabSehat).db, sekarang)).version === null);

  console.log('\n6. bentukCron: jejak lama tanpa `sukses`');
  const lama = bentukCron({ escalate: { waktu: jamLalu(3), ok: true, ringkas: '' }, digest: { waktu: jamLalu(3), ok: false, ringkas: 'x' } });
  cek('ok tanpa sukses -> last_success_at = waktu', lama.escalate.last_success_at === jamLalu(3));
  cek('gagal tanpa sukses -> last_success_at null (tidak diketahui)', lama.digest.last_success_at === null && lama.digest.last_ok === false);

  console.log('\n7. catatCron membawa waktu sukses terakhir melewati kegagalan');
  const tulis = async (awal: JejakCron | null, ok: boolean) => {
    const k = klienTiruan(q => (q.upsert ? { error: null } : { data: awal ? { value: awal } : null, error: null }));
    await catatCron(k.db, 'digest', ok, 'ringkas');
    return (k.kueri.find(q => q.upsert)?.upsert as { value: JejakCron }).value.digest;
  };
  const berhasil = await tulis(null, true);
  cek('jalan berhasil -> sukses = waktu', !!berhasil.sukses && berhasil.sukses === berhasil.waktu);
  const gagalSetelahSukses = await tulis({ digest: { waktu: jamLalu(24), ok: true, ringkas: '', sukses: jamLalu(24) } }, false);
  cek('gagal sesudah sukses -> sukses lama dibawa', gagalSetelahSukses.ok === false && gagalSetelahSukses.sukses === jamLalu(24));
  const gagalJejakLama = await tulis({ digest: { waktu: jamLalu(30), ok: true, ringkas: '' } }, false);
  cek('gagal sesudah jejak lama (tanpa sukses, ok) -> waktu lama jadi sukses', gagalJejakLama.sukses === jamLalu(30));
  const gagalTerus = await tulis({ digest: { waktu: jamLalu(30), ok: false, ringkas: '' } }, false);
  cek('gagal tanpa riwayat sukses -> tanpa sukses', gagalTerus.sukses === undefined);

  console.log('\n8. proxy.ts: /api/monitor lewat gerbang sesi seperti /api/cron/, bukan daftar publik');
  const proxy = readFileSync('proxy.ts', 'utf8');
  const publik = /const PUBLIC_EXACT = \[([\s\S]*?)\];/.exec(proxy)?.[1] ?? '';
  const awalan = /const PUBLIC_PREFIXES = \[([\s\S]*?)\];/.exec(proxy)?.[1] ?? '';
  cek('tidak di PUBLIC_EXACT / PUBLIC_PREFIXES', !publik.includes('/api/monitor') && !awalan.includes('/api/monitor') && publik.length > 0);
  cek("dikecualikan dengan jalur persis (pathname === '/api/monitor')", /const MONITOR_PATH = '\/api\/monitor';/.test(proxy) && /pathname === MONITOR_PATH\) return NextResponse\.next\(\)/.test(proxy));
  const rute = readFileSync('app/api/monitor/route.ts', 'utf8');
  cek('route hanya mengekspor GET', /export function GET\(/.test(rute) && !/export (async )?function (POST|PUT|PATCH|DELETE)/.test(rute));

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
