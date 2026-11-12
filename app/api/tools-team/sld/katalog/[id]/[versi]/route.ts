import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLA_ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; versi: string }> }) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const { id } = await ctx.params;
  if (!POLA_ID.test(id)) return NextResponse.json({ ok: false, alasan: 'ID tidak sah.' }, { status: 400 });
  const { data, error } = await getAdminClient().from('tools_sld_katalog').select('foto').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  const foto = (data as { foto: string | null } | null)?.foto;
  if (!foto) return NextResponse.json({ ok: false, alasan: 'Foto tidak ditemukan.' }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(foto, 'base64')), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
