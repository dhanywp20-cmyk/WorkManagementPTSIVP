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
import { ambilJatahWA } from '@/lib/wa-batas';

//  Batas kirim (tabel wa_kirim_log, migrasi 018) - satu sumber di lib/wa-batas.ts,
//  dipakai juga oleh jalur server DIWAYPI (lib/efek-server.ts).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { target?: string; message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }); }

  const ditolak = await ambilJatahWA(getAdminClient(), jaga.user.id, String(body.target ?? ''));
  if (ditolak) return NextResponse.json({ ok: false, reason: ditolak }, { status: 429 });

  const hasil = await kirimWA(body.target ?? '', body.message ?? '');
  //  Bentuk jawabannya disamakan dengan Edge Function ({ ok, reason }) supaya
  //  lib/wa.ts bisa memperlakukan kedua jalur dengan kode yang sama.
  return NextResponse.json({ ok: hasil.ok, reason: hasil.alasan });
}
