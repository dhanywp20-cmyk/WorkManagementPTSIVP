
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { kirimWA } from '@/lib/wa/kirim-server';
import { getAdminClient } from '@/lib/supabase-admin';
import { ambilJatahWA } from '@/lib/wa/batas';

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
  return NextResponse.json({ ok: hasil.ok, reason: hasil.alasan });
}
