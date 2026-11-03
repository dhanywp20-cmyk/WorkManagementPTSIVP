
import { NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = await bacaRahasia('push.vapid_public_key');
  if (!publicKey) {
    return NextResponse.json({ ok: false, alasan: 'Push notification belum diaktifkan admin.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, publicKey });
}
