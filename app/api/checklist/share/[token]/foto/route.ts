import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, cariChecklistShare, galat, simpanFoto } from '@/lib/checklist-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checklist/share/<token>/foto - PUBLIK. Foto bukti satu item dari
 * tim lapangan (multipart: itemId, full, thumb). Hanya ke item milik checklist
 * dari token itu; ukuran & jenis berkas diperiksa di simpanFoto.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat('Link tidak ditemukan atau sudah dinonaktifkan.', 404);
  let form: FormData;
  try { form = await request.formData(); } catch { return galat('Unggahan tidak terbaca.'); }
  const hasil = await simpanFoto(ketemu.db, ketemu.id, String(form.get('itemId') ?? ''), form);
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
