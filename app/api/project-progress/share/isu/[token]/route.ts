import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, galat, tokenSah } from '@/lib/checklist/server';
import { KOLOM_RIWAYAT, cariGrupShare, muatLokasi, muatSemuaIsu } from '@/lib/isu/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const t = (token ?? '').trim();
  if (!tokenSah(t)) return galat('Link tidak valid.', 404);
  const hasil = await cariGrupShare(t);
  if (!hasil) return galat('Link tidak ditemukan atau sudah dinonaktifkan.', 404);
  const { db, grup } = hasil;

  const isuId = request.nextUrl.searchParams.get('riwayat');
  if (isuId) {
    if (!/^[0-9a-f-]{36}$/i.test(isuId)) return galat('Isu tidak ditemukan.', 404);
    const { data: isu } = await db.from('isu_log').select('id').eq('id', isuId).eq('grup_id', grup.id).maybeSingle();
    if (!isu) return galat('Isu tidak ditemukan.', 404);
    const { data, error } = await db.from('isu_riwayat').select(KOLOM_RIWAYAT).eq('isu_id', isuId).order('created_at');
    if (error) return galat(error.message, 500);
    return NextResponse.json({ riwayat: data ?? [] }, { headers: NO_STORE });
  }

  try {
    const [lokasi, isu] = await Promise.all([muatLokasi(db, grup.proyek_ids), muatSemuaIsu(db, grup, true)]);
    return NextResponse.json({ grup, lokasi, isu }, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat isu.', 500);
  }
}
