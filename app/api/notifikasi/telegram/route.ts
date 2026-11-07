
import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/auth/rahasia-server';
import { pastikanAdmin, pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  if (body.aksi === 'cek') {
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

  if (body.aksi === 'bot_info') {
    const jaga = await pastikanMasuk(req);
    if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = await r.json() as { ok?: boolean; result?: { username?: string }; description?: string };
      if (!j?.ok) return jawab(false, j?.description ?? 'Token ditolak Telegram.');
      return jawab(true, undefined, { bot: j.result?.username ?? '' });
    } catch {
      return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
    }
  }

  if (body.aksi === 'hubungkan') {
    const jaga = await pastikanMasuk(req);
    if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
      const j = await r.json() as {
        ok?: boolean; description?: string;
        result?: { message?: { text?: string; chat?: { id?: number } } }[];
      };
      if (!j?.ok) return jawab(false, j?.description ?? 'Telegram menolak permintaan getUpdates.');

      const cocok = (j.result ?? []).find(u => u?.message?.text?.trim() === `/start ${jaga.user.id}`);
      if (!cocok?.message?.chat?.id) {
        return jawab(false,
          'Belum terbaca. Pastikan sudah menekan Start di bot (bukan sekadar membuka chat-nya), lalu coba lagi. '
          + 'Telegram hanya menyimpan pesan yang belum terbaca selama 24 jam.');
      }

      const db = getAdminClient();
      const { error } = await db.from('users')
        .update({ telegram_chat_id: String(cocok.message.chat.id) })
        .eq('id', jaga.user.id);
      if (error) return jawab(false, error.message);
      return jawab(true);
    } catch {
      return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
    }
  }

  if (body.aksi === 'putuskan') {
    const jaga = await pastikanMasuk(req);
    if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
    const db = getAdminClient();
    const { error } = await db.from('users').update({ telegram_chat_id: null }).eq('id', jaga.user.id);
    if (error) return jawab(false, error.message);
    return jawab(true);
  }

  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const chatId = (body.chatId ?? '').trim();
  const pesan = (body.pesan ?? '').trim().slice(0, 4000);
  if (!chatId) return jawab(false, 'Chat ID belum diisi.');
  if (!pesan)  return jawab(false, 'Pesan kosong.');

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: pesan }),
    });
    const j = await r.json() as { ok?: boolean; description?: string };
    if (!j?.ok) {
      return jawab(false, j?.description ?? 'Telegram menolak pesan.');
    }
    return jawab(true);
  } catch {
    return jawab(false, 'Tidak bisa menghubungi api.telegram.org.');
  }
}
