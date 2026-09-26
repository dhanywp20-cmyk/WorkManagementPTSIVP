/**
 * /api/notifikasi/whatsapp/kirim - jalur kirim WA (semua penyedia).
 *
 * SATU-SATUNYA jalur kirim WA dari peramban, untuk semua penyedia (Fonnte,
 * Cloud API, webhook). Token dibaca dari Admin Panel -> Integrations
 * (rahasia_integrasi). Edge Function `swift-responder` tidak dipakai lagi.
 *
 * PENJAGANYA SESI, BUKAN ADMIN. Yang memicu pengiriman di sini adalah
 * pekerjaan sehari-hari siapa pun di tim (membuat tiket, mengalihkan jadwal),
 * jadi mensyaratkan admin akan mematikan notifikasi untuk semua orang. Tapi ia
 * tetap tidak boleh terbuka: tanpa sesi, alamat ini jadi alat kirim WA gratis
 * bagi siapa pun yang menemukannya.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { kirimWA } from '@/lib/wa-kirim-server';
import { getAdminClient } from '@/lib/supabase-admin';

//  Batas kirim (tabel wa_kirim_log, migrasi 018). Satu aksi kerja bisa memicu
//  beberapa WA sekaligus, jadi batas per menit longgar; yang dicegah adalah
//  pemakaian sebagai alat blast / spam ke satu nomor.
const BATAS_PER_MENIT = 60;
const BATAS_PER_HARI = 600;
const BATAS_TARGET_PER_MENIT = 6;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { target?: string; message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }); }

  const target = String(body.target ?? '').replace(/\D/g, '');
  const db = getAdminClient();
  const sejak = (ms: number) => new Date(Date.now() - ms).toISOString();
  const hitung = (kolom: 'user_id' | 'target', nilai: string, ms: number) =>
    db.from('wa_kirim_log').select('id', { count: 'exact', head: true })
      .eq(kolom, nilai).gte('created_at', sejak(ms));
  const [menit, hari, keTarget] = await Promise.all([
    hitung('user_id', jaga.user.id, 60_000),
    hitung('user_id', jaga.user.id, 86_400_000),
    hitung('target', target, 60_000),
  ]);
  if ((menit.count ?? 0) >= BATAS_PER_MENIT || (hari.count ?? 0) >= BATAS_PER_HARI
      || (keTarget.count ?? 0) >= BATAS_TARGET_PER_MENIT) {
    return NextResponse.json({ ok: false, reason: 'Terlalu banyak pengiriman WA. Coba lagi sebentar lagi.' }, { status: 429 });
  }
  await db.from('wa_kirim_log').insert({ user_id: jaga.user.id, target });

  const hasil = await kirimWA(body.target ?? '', body.message ?? '');
  //  Bentuk jawabannya disamakan dengan Edge Function ({ ok, reason }) supaya
  //  lib/wa.ts bisa memperlakukan kedua jalur dengan kode yang sama.
  return NextResponse.json({ ok: hasil.ok, reason: hasil.alasan });
}
