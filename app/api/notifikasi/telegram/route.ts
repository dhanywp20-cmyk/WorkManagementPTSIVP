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
 * Tokennya dibaca lewat bacaRahasia() - dari tabel rahasia_integrasi yang
 * diatur admin di Admin Panel, dengan variabel lingkungan TELEGRAM_BOT_TOKEN
 * sebagai cadangan. Keduanya hanya ada di sisi server; tidak ada jalur yang
 * mengirimkannya ke peramban.
 *
 * Sama seperti WhatsApp: kegagalan kirim TIDAK boleh menggagalkan alur utama.
 * Route ini selalu menjawab 200 dengan { ok: false, alasan } saat gagal,
 * bukan status galat - supaya pemanggilnya tidak perlu membedakan "gagal
 * kirim" dari "jaringan putus".
 */

import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';
import { pastikanAdmin } from '@/lib/penjaga-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Jawaban seragam. Selalu 200 - lihat catatan di atas. */
function jawab(ok: boolean, alasan?: string, tambahan?: Record<string, unknown>) {
  return NextResponse.json({ ok, ...(alasan ? { alasan } : {}), ...(tambahan ?? {}) });
}

export async function POST(req: NextRequest) {
  const token = await bacaRahasia('telegram.bot_token');
  if (!token) {
    return jawab(false, 'Token bot Telegram belum diisi. Isi di Admin Panel → Integrations.');
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
    //  Hanya aksi tes yang dijaga admin. Pengiriman biasa dipanggil router
    //  notifikasi atas nama user mana pun yang memicu kejadiannya - menjaga
    //  yang itu dengan penjaga admin akan mematikan seluruh notifikasi
    //  Telegram untuk semua orang selain admin.
    const jaga = await pastikanAdmin(req);
    if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = await r.json() as { ok?: boolean; result?: { username?: string }; description?: string };
      if (!j?.ok) return jawab(false, j?.description ?? 'Token ditolak Telegram.');
      return jawab(true, undefined, { bot: j.result?.username ?? '(tanpa nama)' });
    } catch {
      return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
    }
  }

  /*
    aksi 'chat' - MENEMUKAN Chat ID, bukan menyuruh admin mencarinya sendiri.

    Bot yang dibuat lewat @BotFather tidak menjawab perintah apa pun dengan
    sendirinya: tidak ada /id, tidak ada /start yang membalas. Platform ini pun
    tidak memasang webhook maupun pemroses pesan masuk. Jadi petunjuk gaya
    "kirim /id ke bot lalu salin balasannya" akan berakhir dengan admin
    menunggu balasan yang tidak akan pernah datang.

    Yang BENAR-BENAR bekerja adalah getUpdates: admin cukup mengirim satu pesan
    apa pun ke botnya (atau ke grup yang sudah diundangi bot itu), lalu daftar
    percakapan yang menyapa bot dibacakan dari sini beserta id-nya.
  */
  if (body.aksi === 'chat') {
    const jaga = await pastikanAdmin(req);
    if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
      const j = await r.json() as {
        ok?: boolean; description?: string;
        result?: { message?: { chat?: { id?: number; type?: string; title?: string; username?: string; first_name?: string } } }[];
      };
      if (!j?.ok) {
        //  409 terjadi bila webhook terpasang - getUpdates dan webhook tidak
        //  bisa hidup bersamaan. Disebut apa adanya supaya tidak terbaca
        //  sebagai "token salah".
        return jawab(false, j?.description ?? 'Telegram menolak permintaan getUpdates.');
      }
      const seen = new Map<string, { id: string; nama: string; jenis: string }>();
      for (const u of j.result ?? []) {
        const c = u?.message?.chat;
        if (!c?.id) continue;
        const id = String(c.id);
        if (seen.has(id)) continue;
        seen.set(id, {
          id,
          nama: c.title
            ?? ([c.first_name, c.username ? `@${c.username}` : ''].filter(Boolean).join(' ') || id),
          jenis: c.type ?? 'private',
        });
      }
      const chat = [...seen.values()];
      if (chat.length === 0) {
        return jawab(false,
          'Belum ada percakapan yang terbaca. Kirim satu pesan apa pun ke bot (atau ke grup yang sudah diundangi bot), lalu tekan tombol ini lagi. Telegram hanya menyimpan pesan yang belum terbaca selama 24 jam.');
      }
      return jawab(true, undefined, { chat });
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
