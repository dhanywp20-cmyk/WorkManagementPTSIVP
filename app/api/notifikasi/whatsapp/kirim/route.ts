/**
 * /api/notifikasi/whatsapp/kirim - jalur kirim WA untuk penyedia SELAIN Fonnte.
 *
 * KENAPA JALUR TERPISAH, bukan mengganti yang lama
 *
 * Pengiriman WA sehari-hari (48 titik) berjalan lewat lib/wa.ts -> Edge
 * Function `swift-responder` -> Fonnte. Jalur itu melayani produksi setiap
 * hari dan tidak disentuh: selama admin memakai Fonnte, tidak ada satu byte
 * pun yang berubah dari perilaku hari ini.
 *
 * Route ini baru terpakai ketika admin BENAR-BENAR memindahkan penyedia ke
 * Cloud API resmi atau webhook kustom - hal yang tidak bisa dikerjakan Edge
 * Function itu karena Fonnte tertanam di dalamnya. Jadi risiko perpindahan
 * ditanggung oleh orang yang memilih berpindah, bukan ditimpakan lebih dulu
 * ke seluruh tim.
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { target?: string; message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }); }

  const hasil = await kirimWA(body.target ?? '', body.message ?? '');
  //  Bentuk jawabannya disamakan dengan Edge Function ({ ok, reason }) supaya
  //  lib/wa.ts bisa memperlakukan kedua jalur dengan kode yang sama.
  return NextResponse.json({ ok: hasil.ok, reason: hasil.alasan });
}
