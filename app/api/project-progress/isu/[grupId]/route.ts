import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat, tokenBaru } from '@/lib/checklist/server';
import { KOLOM_GRUP, hakIsu, isianGrup, muatGrup, muatLokasi, muatSemuaIsu } from '@/lib/isu/server';
import { rapikanLatarShare } from '@/lib/share-latar';
import type { TablesUpdate } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, ctx: { params: Promise<{ grupId: string }> }) {
  const { grupId } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const hak = hakIsu(s.akun);
  if (!hak.lihat) return galat('Issue Log hanya untuk tim internal.', 403);

  const grup = await muatGrup(s.db, grupId);
  if (!grup) return galat('Grup tidak ditemukan.', 404);
  try {
    const [lokasi, isu] = await Promise.all([muatLokasi(s.db, grup.proyek_ids), muatSemuaIsu(s.db, grup, false)]);
    return NextResponse.json({
      grup: hak.edit ? grup : { ...grup, share_token: null }, lokasi, isu,
      hak: { edit: hak.edit, admin: hak.admin, kelola: hak.kelola },
    }, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat isu.', 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ grupId: string }> }) {
  const { grupId } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const hak = hakIsu(s.akun);
  if (!hak.edit) return galat('Anda tidak punya akses mengubah grup.', 403);
  const grup = await muatGrup(s.db, grupId);
  if (!grup) return galat('Grup tidak ditemukan.', 404);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  let ubah: TablesUpdate<'isu_grup'>;
  if (body.aksi === 'share') {
    ubah = { share_aktif: body.aktif === true };
    if (body.aktif === true && !grup.share_token) ubah.share_token = tokenBaru();
  } else if (body.aksi === 'tokenBaru') {
    ubah = { share_token: tokenBaru() };
  } else if (body.aksi === 'latar') {
    if (!hak.kelola) return galat('Hanya admin atau Manager PTS yang bisa mengganti latar link.', 403);
    const share_latar = rapikanLatarShare(body.latar);
    if (share_latar === undefined) return galat('Gambar latar tidak valid. Unggah ulang gambarnya.');
    ubah = { share_latar };
  } else {
    if (!hak.kelola) return galat('Hanya admin atau Manager PTS yang bisa mengubah nama & proyek grup.', 403);
    const hasil = isianGrup(body);
    if ('galat' in hasil) return galat(hasil.galat);
    ubah = hasil.isian;
  }
  const { data, error } = await s.db.from('isu_grup').update(ubah).eq('id', grupId)
    .select(KOLOM_GRUP).single();
  if (error) return galat(error.message, 500);
  return NextResponse.json({ grup: data }, { headers: NO_STORE });
}
