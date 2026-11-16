import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat } from '@/lib/checklist/server';
import { BATAS_FOTO, BUCKET } from '@/lib/checklist/server-simpan';
import { KOLOM_ISU, catatRiwayat, hakIsu } from '@/lib/isu/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).edit) return galat('Anda tidak punya akses mengubah isu.', 403);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return galat('Isu tidak ditemukan.', 404);
  const { data: isu } = await s.db.from('isu_log').select('id,grup_id').eq('id', id).maybeSingle();
  if (!isu) return galat('Isu tidak ditemukan.', 404);

  let form: FormData;
  try { form = await request.formData(); } catch { return galat('Unggahan tidak terbaca.'); }
  const full = form.get('full');
  const thumb = form.get('thumb');
  if (!(full instanceof Blob) || full.size === 0) return galat('Foto tidak terbaca.');
  if (full.size > BATAS_FOTO || (thumb instanceof Blob && thumb.size > BATAS_FOTO)) return galat('Foto terlalu besar (maks 5 MB).');
  if (!/^image\//.test(full.type)) return galat('Berkas harus gambar.');

  const base = `project-progress/isu/${isu.grup_id}/${id}-${Date.now()}`;
  const ext = full.type === 'image/png' ? 'png' : full.type === 'image/webp' ? 'webp' : 'jpg';
  const up = await s.db.storage.from(BUCKET).upload(`${base}.${ext}`, full, { contentType: full.type, cacheControl: '31536000', upsert: false });
  if (up.error) return galat('Unggah foto gagal: ' + up.error.message, 500);
  const fullUrl = s.db.storage.from(BUCKET).getPublicUrl(`${base}.${ext}`).data.publicUrl;
  let thumbUrl = fullUrl;
  if (thumb instanceof Blob && thumb.size > 0) {
    const t = await s.db.storage.from(BUCKET).upload(`${base}-thumb.${ext}`, thumb, { contentType: thumb.type || full.type, cacheControl: '31536000', upsert: false });
    if (!t.error) thumbUrl = s.db.storage.from(BUCKET).getPublicUrl(`${base}-thumb.${ext}`).data.publicUrl;
  }

  const { data, error } = await s.db.from('isu_log')
    .update({ foto_url: fullUrl, foto_thumb_url: thumbUrl, diubah_oleh_nama: s.akun.nama }).eq('id', id).select(KOLOM_ISU).single();
  if (error) return galat(error.message, 500);
  await catatRiwayat(s.db, [{ isu_id: id, aksi: 'ubah', nama: s.akun.nama, keterangan: 'Mengunggah foto' }]);
  return NextResponse.json({ isu: data }, { headers: NO_STORE });
}
