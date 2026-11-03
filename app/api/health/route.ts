import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const tubuh = () => ({ ok: true, waktu: new Date().toISOString(), komit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null });
const kepala = { 'Cache-Control': 'no-store' };

export function GET() {
  return NextResponse.json(tubuh(), { headers: kepala });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: kepala });
}
