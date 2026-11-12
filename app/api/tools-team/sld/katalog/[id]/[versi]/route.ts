import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { urlFotoTim } from '@/lib/sld/katalog-tim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLA_ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; versi: string }> }) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const { id, versi } = await ctx.params;
  if (!POLA_ID.test(id)) return NextResponse.json({ ok: false, alasan: 'ID tidak sah.' }, { status: 400 });
  const { data, error } = await getAdminClient().from('tools_sld_katalog').select('foto, versi').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  const baris = data as { foto: string | null; versi: number } | null;
  if (!baris?.foto) return NextResponse.json({ ok: false, alasan: 'Foto tidak ditemukan.' }, { status: 404 });
  if (Number(versi) !== baris.versi) {
    const r = NextResponse.redirect(new URL(urlFotoTim(id, baris.versi), req.url), 307);
    r.headers.set('Cache-Control', 'private, no-store');
    return r;
  }
  return new NextResponse(new Uint8Array(Buffer.from(baris.foto, 'base64')), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
