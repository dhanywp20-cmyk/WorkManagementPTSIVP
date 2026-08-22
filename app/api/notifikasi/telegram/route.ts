/**
 * /api/notifikasi/telegram - satu-satunya jalur pengiriman Telegram.
 *
 * KENAPA LEWAT ROUTE SERVER, bukan langsung dari peramban seperti WhatsApp
 *
 * WhatsApp di platform ini dikirim dari sisi klien ke Supabase Edge Function
 * `swift-responder`, dan tokennya aman karena tinggal di secret Edge Function -
 * peramban tidak pernah melihatnya. Telegram tidak punya perantara semacam
 * itu: memanggil api.telegram.org langsung dari peramban berarti token botnya
 * ikut terkirim ke setiap pengunjung, dan siapa pun yang membuka DevTools bisa
 * memakai bot itu sesukanya.
 *
 * Karena itu tokennya tinggal di TELEGRAM_BOT_TOKEN (variabel lingkungan sisi
 * server, tidak berawalan NEXT_PUBLIC_ sehingga tidak ikut ter-bundle) dan
 * hanya berkas ini yang menyentuhnya.
 *
 * Sama seperti WhatsApp: kegagalan kirim TIDAK boleh menggagalkan alur utama.
 * Route ini selalu menjawab 200 dengan { ok: false, alasan } saat gagal,
 * bukan status galat - supaya pemanggilnya tidak perlu membedakan "gagal
 * kirim" dari "jaringan putus".
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Jawaban seragam. Selalu 200 - lihat catatan di atas. */
function jawab(ok: boolean, alasan?: string, tambahan?: Record<string, unknown>) {
  return NextResponse.json({ ok, ...(alasan ? { alasan } : {}), ...(tambahan ?? {}) });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return jawab(false, 'TELEGRAM_BOT_TOKEN belum diatur di lingkungan server. '
      + 'Isi di Vercel -> Settings -> Environment Variables, lalu deploy ulang.');
  }

  let body: { chatId?: string; pesan?: string; aksi?: string };
  try {
    body = await req.json();
  } catch {
    return jawab(false, 'Isi permintaan bukan JSON yang sah.');
  }

  //  aksi 'cek' hanya memastikan tokennya sah dan botnya hidup - tidak
  //  mengirim pesan ke siapa pun. Dipakai tombol "Tes Koneksi" supaya admin
  //  bisa memastikan tokennya benar tanpa mengganggu grup.
  if (body.aksi === 'cek') {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = await r.json() as { ok?: boolean; result?: { username?: string }; description?: string };
      if (!j?.ok) return jawab(false, j?.description ?? 'Token ditolak Telegram.');
      return jawab(true, undefined, { bot: j.result?.username ?? '(tanpa nama)' });
    } catch {
      return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
    }
  }

  const chatId = (body.chatId ?? '').trim();
  const pesan = (body.pesan ?? '').trim();
  if (!chatId) return jawab(false, 'Chat ID belum diisi.');
  if (!pesan)  return jawab(false, 'Pesan kosong.');

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: pesan, parse_mode: 'HTML' }),
    });
    const j = await r.json() as { ok?: boolean; description?: string };
    if (!j?.ok) {
      //  Pesan galat Telegram diteruskan apa adanya. Yang paling sering muncul
      //  "chat not found" (bot belum diundang ke grup) dan "bot was blocked" -
      //  keduanya perlu tindakan admin yang berbeda, jadi menyamarkannya jadi
      //  "gagal kirim" hanya akan memperpanjang penelusuran.
      return jawab(false, j?.description ?? 'Telegram menolak pesan.');
    }
    return jawab(true);
  } catch {
    return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
  }
}
