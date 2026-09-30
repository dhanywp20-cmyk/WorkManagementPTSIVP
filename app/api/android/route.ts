/**
 * /api/android - rilis APK Android (Admin Panel -> Aplikasi Android).
 *
 *   GET                 siapa pun yang masuk: rilis terbaru (metadata saja).
 *   GET ?riwayat=1      admin: + 10 rilis terakhir.
 *   POST {aksi:'siapkan', versi, kode_versi, ukuran}
 *                       admin: signed upload URL. Peramban mengunggah APK
 *                       LANGSUNG ke Supabase Storage - tidak lewat Vercel
 *                       (batas body 4,5 MB & hemat bandwidth fungsi).
 *   POST {aksi:'terbitkan', path, versi, kode_versi, catatan, wajib}
 *                       admin: cek berkasnya benar ada, catat rilisnya, dan
 *                       buang berkas rilis lama (sisakan 2) supaya kuota
 *                       Storage free plan tidak habis.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pastikanAdmin, pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'aplikasi-android';
const MAKS_UKURAN = 100 * 1024 * 1024;
const SIMPAN_BERKAS = 2;
const KOLOM = 'id, versi, kode_versi, ukuran, catatan, wajib, diunggah_pada, path';
const POLA_VERSI = /^[0-9A-Za-z.\-]{1,32}$/;

const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Baris = { id: string; versi: string; kode_versi: number; ukuran: number; catatan: string | null; wajib: boolean; diunggah_pada: string; path: string | null };
const publik = ({ path, ...r }: Baris) => ({ ...r, tersedia: !!path });

export async function GET(req: NextRequest) {
  const mauRiwayat = req.nextUrl.searchParams.get('riwayat') === '1';
  const jaga = mauRiwayat ? await pastikanAdmin(req) : await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);

  const { data, error } = await getAdminClient().from('rilis_android').select(KOLOM)
    .order('kode_versi', { ascending: false }).limit(mauRiwayat ? 10 : 1);
  if (error) return gagal(error.message, 500);
  const baris = (data ?? []) as Baris[];
  const terbaru = baris.find(b => b.path) ?? null;
  return NextResponse.json(
    { ok: true, terbaru: terbaru ? publik(terbaru) : null, ...(mauRiwayat ? { riwayat: baris.map(publik) } : {}) },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const versi = String(b.versi ?? '').trim().replace(/^v/i, '');
  const kode = Number(b.kode_versi);
  if (!POLA_VERSI.test(versi)) return gagal('Versi tidak sah (mis. 1.0.1).');
  if (!Number.isInteger(kode) || kode < 1 || kode > 2_100_000_000) return gagal('Kode versi harus bilangan bulat positif.');

  const db = getAdminClient();
  const { data: puncak } = await db.from('rilis_android').select('kode_versi')
    .order('kode_versi', { ascending: false }).limit(1).maybeSingle();
  if (puncak && kode <= puncak.kode_versi) {
    return gagal(`Kode versi harus lebih besar dari rilis terakhir (${puncak.kode_versi}). Android menolak memasang versi yang kodenya tidak naik.`);
  }

  if (b.aksi === 'siapkan') {
    const ukuran = Number(b.ukuran);
    if (!Number.isFinite(ukuran) || ukuran <= 0 || ukuran > MAKS_UKURAN) return gagal('Ukuran berkas maksimal 100 MB.');
    const path = `rilis/${kode}-${crypto.randomBytes(6).toString('hex')}.apk`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return gagal(error?.message ?? 'Gagal menyiapkan unggahan.', 500);
    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  }

  if (b.aksi === 'terbitkan') {
    const path = String(b.path ?? '');
    if (!new RegExp(`^rilis/${kode}-[0-9a-f]{12}\\.apk$`).test(path)) return gagal('Path berkas tidak sah.');
    const nama = path.slice('rilis/'.length);
    const { data: daftar } = await db.storage.from(BUCKET).list('rilis', { search: nama, limit: 1 });
    const obj = daftar?.find(o => o.name === nama);
    const ukuran = Number((obj?.metadata as { size?: number } | undefined)?.size ?? 0);
    if (!obj || ukuran <= 0) return gagal('Berkas APK belum terunggah.');

    const catatan = String(b.catatan ?? '').trim().slice(0, 2000) || null;
    const { data: baru, error } = await db.from('rilis_android').insert({
      versi, kode_versi: kode, ukuran, path, catatan, wajib: b.wajib === true, diunggah_oleh: jaga.user.id,
    }).select(KOLOM).single();
    if (error || !baru) {
      await db.storage.from(BUCKET).remove([path]);
      return gagal(error?.message ?? 'Gagal mencatat rilis.', 500);
    }

    // Berkas lama dibuang, barisnya tetap (riwayat & catatan perubahan).
    const { data: lama } = await db.from('rilis_android').select('id, path')
      .not('path', 'is', null).order('kode_versi', { ascending: false }).range(SIMPAN_BERKAS, 50);
    if (lama?.length) {
      await db.storage.from(BUCKET).remove(lama.map((l: { path: string | null }) => l.path as string));
      await db.from('rilis_android').update({ path: null }).in('id', lama.map((l: { id: string }) => l.id));
    }
    return NextResponse.json({ ok: true, rilis: publik(baru as Baris) });
  }

  return gagal('Aksi tidak dikenal.');
}
