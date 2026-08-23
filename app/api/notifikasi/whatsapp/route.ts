/**
 * /api/notifikasi/whatsapp - tes koneksi & kirim pesan tes WhatsApp.
 *
 * Route ini tidak lagi tahu-menahu soal Fonnte. Ia memanggil
 * lib/wa-kirim-server.ts, yang memilih gateway sesuai penyedia yang diatur
 * admin di Admin Panel → Integrations (Fonnte / WhatsApp Cloud API resmi /
 * webhook kustom). Dengan begitu tombol Tes Koneksi menguji penyedia yang
 * BENAR-BENAR akan dipakai, bukan penyedia yang kebetulan tertulis di kode.
 *
 * Selalu menjawab 200 dengan { ok, alasan } - kegagalan kirim bukan galat
 * HTTP, supaya pemanggilnya tidak perlu membedakan "ditolak gateway" dari
 * "jaringan putus".
 */

import { NextRequest, NextResponse } from 'next/server';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { cekKoneksiWA, kirimWA } from '@/lib/wa-kirim-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  //  Route ini mengirim pesan sungguhan dan memakai kuota gateway, jadi
  //  dijaga admin - bukan karena isinya rahasia, tapi karena kalau terbuka ia
  //  jadi alat kirim WA gratis untuk siapa saja yang menemukannya.
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { aksi?: string; target?: string; pesan?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }); }

  //  'cek' memastikan kredensialnya sah tanpa mengirim pesan ke siapa pun -
  //  tanpa mengganggu nomor mana pun dan tanpa memotong kuota.
  const hasil = body.aksi === 'cek'
    ? await cekKoneksiWA()
    : await kirimWA(body.target ?? '', body.pesan ?? '');

  return NextResponse.json(hasil);
}
