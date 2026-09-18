/**
 * /api/push/vapid-public-key - kunci publik VAPID, dibutuhkan browser untuk
 * pushManager.subscribe({ applicationServerKey }).
 *
 * TANPA penjaga login - kunci publik memang dirancang untuk dikirim ke
 * peramban (standar Web Push API), beda dengan kunci privat yang tidak
 * pernah meninggalkan server. Tetap harus login untuk bisa mendaftar
 * (/api/push/subscribe menjaganya), jadi kunci publik sendirian tidak
 * berguna bagi siapa pun di luar aplikasi ini.
 */

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
