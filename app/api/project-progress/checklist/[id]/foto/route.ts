import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat, hakAtas, simpanFoto } from '@/lib/checklist-server';

export const dynamic = 'force-dynamic';

/** POST /api/project-progress/checklist/<id>/foto - multipart: itemId, full, thumb. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const akses = await hakAtas(s.db, s.akun, params.id);
  if (!akses) return galat('Checklist tidak ditemukan.', 404);
  if (!akses.hak.edit) return galat('Anda tidak di-assign ke checklist ini.', 403);

  let form: FormData;
  try { form = await request.formData(); } catch { return galat('Unggahan tidak terbaca.'); }
  const hasil = await simpanFoto(s.db, params.id, String(form.get('itemId') ?? ''), form);
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
