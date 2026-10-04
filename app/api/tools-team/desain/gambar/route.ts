/**
 * /api/tools-team/desain/gambar?id=&v=[&hd=1] - gambar satu VERSI desain.
 *
 * Gambar sengaja tidak ikut di JSON daftar: dikirim terpisah sebagai JPEG
 * dengan Cache-Control immutable. Versi tidak pernah berubah, jadi peramban
 * cukup mengunduhnya sekali lalu memakai cache - hemat egress Supabase &
 * bandwidth Vercel (paket gratis/Hobby). hd=1 (±1400 px) hanya untuk cetak/ZIP;
 * bila tidak ada, jatuh ke pratinjau kecil.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLA_ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return new NextResponse(null, { status: jaga.status });
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id') ?? '', versi = Number(sp.get('v'));
  if (!POLA_ID.test(id) || !Number.isInteger(versi) || versi < 1) return new NextResponse(null, { status: 400 });
  const hd = sp.get('hd') === '1';
  const { data } = await getAdminClient().from('tools_desain_ruang_versi')
    .select(hd ? 'gambar, gambar_hd' : 'gambar').eq('desain_id', id).eq('versi', versi).maybeSingle();
  const baris = data as { gambar?: string | null; gambar_hd?: string | null } | null;
  const url = (hd ? baris?.gambar_hd || baris?.gambar : baris?.gambar) ?? '';
  const m = /^data:(image\/(?:jpeg|webp));base64,(.+)$/.exec(url);
  if (!m) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, max-age=300' } });
  return new NextResponse(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
