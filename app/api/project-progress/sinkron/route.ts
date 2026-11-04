import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat } from '@/lib/checklist-server';
import { daftarId } from '@/lib/checklist-isian';
import { sinkronkanReminderKeProgress } from '@/lib/sinkron-progress-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const { db, akun } = s;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const ids = daftarId(body.reminderIds).slice(0, 100);
  try {
    const out = await sinkronkanReminderKeProgress(db, akun, ids, request.nextUrl.origin);
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : String(e), 500);
  }
}
