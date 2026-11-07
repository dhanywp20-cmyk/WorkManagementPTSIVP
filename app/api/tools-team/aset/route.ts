import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return new NextResponse(null, { status: jaga.status });
  const h = req.nextUrl.searchParams.get('h') ?? '';
  if (!/^[0-9a-f]{40}$/.test(h)) return new NextResponse(null, { status: 400 });
  const { data } = await getAdminClient().from('tools_gambar_desain').select('data').eq('hash', h).maybeSingle();
  const m = /^data:(image\/(?:jpeg|webp));base64,(.+)$/.exec((data as { data?: string } | null)?.data ?? '');
  if (!m) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, max-age=300' } });
  return new NextResponse(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable', ETag: `"${h}"` },
  });
}
