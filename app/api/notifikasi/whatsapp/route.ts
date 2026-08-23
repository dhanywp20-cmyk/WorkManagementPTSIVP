/**
 * /api/notifikasi/whatsapp - tes koneksi & kirim pesan tes WhatsApp (Fonnte).
 *
 * KENAPA ROUTE INI ADA, padahal pengiriman WA sehari-hari tidak lewat sini
 *
 * Pengiriman normal tetap lewat lib/wa.ts -> Supabase Edge Function
 * `swift-responder` -> Fonnte. Jalur itu berjalan di produksi dan tidak
 * disentuh berkas ini - mengubah 48 titik pengiriman sekaligus tanpa bisa
 * menguji pengirimannya sungguhan adalah risiko yang tidak sebanding.
 *
 * Yang route ini kerjakan adalah hal yang TIDAK BISA dikerjakan Edge Function
 * itu: memakai token yang diatur admin dari Admin Panel (tabel
 * rahasia_integrasi), supaya admin bisa memastikan tokennya benar tanpa
 * membuka dashboard Fonnte maupun Supabase.
 *
 * Sama seperti Telegram: selalu menjawab 200 dengan { ok, alasan } - kegagalan
 * kirim bukan galat HTTP, supaya pemanggilnya tidak perlu membedakan
 * "ditolak gateway" dari "jaringan putus".
 */

import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';
import { pastikanAdmin } from '@/lib/penjaga-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jawab(ok: boolean, alasan?: string, tambahan?: Record<string, unknown>) {
  return NextResponse.json({ ok, ...(alasan ? { alasan } : {}), ...(tambahan ?? {}) });
}

export async function POST(req: NextRequest) {
  //  Route ini mengirim pesan sungguhan dan memakai kuota gateway, jadi
  //  dijaga admin - bukan karena isinya rahasia, tapi karena kalau terbuka ia
  //  jadi alat kirim WA gratis untuk siapa saja yang menemukannya.
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const token = await bacaRahasia('whatsapp.token');
  if (!token) {
    return jawab(false, 'Token WhatsApp belum diisi. Isi di Admin Panel → Integrations.');
  }

  let body: { aksi?: string; target?: string; pesan?: string };
  try { body = await req.json(); }
  catch { return jawab(false, 'Isi permintaan bukan JSON.'); }

  //  'cek' menanyakan keadaan perangkat ke Fonnte tanpa mengirim pesan ke
  //  siapa pun - supaya admin bisa memastikan tokennya sah tanpa mengganggu
  //  nomor mana pun dan tanpa memotong kuota.
  if (body.aksi === 'cek') {
    try {
      const r = await fetch('https://api.fonnte.com/device', {
        method: 'POST', headers: { Authorization: token },
      });
      const j = await r.json() as { status?: boolean; reason?: string; device?: string; name?: string };
      if (j?.status === false) return jawab(false, j?.reason ?? 'Token ditolak Fonnte.');
      return jawab(true, undefined, { perangkat: j?.device ?? j?.name ?? '(tersambung)' });
    } catch {
      return jawab(false, 'Tidak bisa menghubungi api.fonnte.com.');
    }
  }

  const target = (body.target ?? '').trim();
  const pesan = (body.pesan ?? '').trim();
  if (!target) return jawab(false, 'Nomor tujuan belum diisi.');
  if (!pesan)  return jawab(false, 'Pesan kosong.');

  try {
    const r = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message: pesan }),
    });
    const j = await r.json() as { status?: boolean; reason?: string };
    if (j?.status === false) return jawab(false, j?.reason ?? 'Fonnte menolak pesan.');
    return jawab(true);
  } catch {
    return jawab(false, 'Tidak bisa menghubungi api.fonnte.com.');
  }
}
