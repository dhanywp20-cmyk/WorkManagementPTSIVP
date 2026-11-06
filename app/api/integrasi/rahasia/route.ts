
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/auth/penjaga-admin';
import { KUNCI_RAHASIA, galatBentukRahasia, type KunciRahasia } from '@/lib/auth/rahasia-kunci';
import { lupakanRahasia } from '@/lib/auth/rahasia-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sah(k: string): k is KunciRahasia {
  return (KUNCI_RAHASIA as readonly string[]).includes(k);
}

function samarkan(nilai: string): string {
  const bersih = nilai.trim();
  return bersih.length <= 6 ? '••••' : `…${bersih.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const db = getAdminClient();
  const { data } = await db.from('rahasia_integrasi').select('kunci, nilai, diperbarui_pada, diperbarui_oleh');

  const CADANGAN_ENV: Record<string, string | undefined> = {
    'whatsapp.token':     process.env.FONNTE_TOKEN,
    'telegram.bot_token': process.env.TELEGRAM_BOT_TOKEN,
    'ai.gemini_token':    process.env.GEMINI_API_KEY,
  };

  const status: Record<string, {
    terisi: boolean; penanda?: string; diperbarui?: string; oleh?: string; dariEnv?: boolean;
  }> = {};
  for (const k of KUNCI_RAHASIA) {
    status[k] = CADANGAN_ENV[k]
      ? { terisi: true, dariEnv: true, penanda: samarkan(CADANGAN_ENV[k] as string) }
      : { terisi: false };
  }
  for (const r of data ?? []) {
    if (!sah(r.kunci)) continue;
    status[r.kunci] = {
      terisi: true,
      dariEnv: false,
      penanda: samarkan(r.nilai as string),
      diperbarui: r.diperbarui_pada as string,
      oleh: (r.diperbarui_oleh as string) ?? undefined,
    };
  }
  return NextResponse.json({ ok: true, status });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { kunci?: string; nilai?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const kunci = (body.kunci ?? '').trim();
  const nilai = (body.nilai ?? '').trim();
  if (!sah(kunci)) return NextResponse.json({ ok: false, alasan: 'Kunci tidak dikenal.' }, { status: 400 });
  if (!nilai)      return NextResponse.json({ ok: false, alasan: 'Nilai kosong.' }, { status: 400 });

  const masalahBentuk = galatBentukRahasia(kunci, nilai);
  if (masalahBentuk) return NextResponse.json({ ok: false, alasan: masalahBentuk }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from('rahasia_integrasi').upsert({
    kunci, nilai,
    diperbarui_pada: new Date().toISOString(),
    diperbarui_oleh: jaga.user.full_name || jaga.user.username,
  }, { onConflict: 'kunci' });

  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  lupakanRahasia(kunci);
  return NextResponse.json({ ok: true, penanda: samarkan(nilai) });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const kunci = (new URL(req.url).searchParams.get('kunci') ?? '').trim();
  if (!sah(kunci)) return NextResponse.json({ ok: false, alasan: 'Kunci tidak dikenal.' }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from('rahasia_integrasi').delete().eq('kunci', kunci);
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  lupakanRahasia(kunci);
  return NextResponse.json({ ok: true });
}
