import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { NO_STORE, akunAdmin, ambilAkun, galat } from '@/lib/checklist/server';
import { akunManager } from '@/lib/isu/server';
import { BATAS_LATAR_SHARE, BUCKET_LATAR_SHARE, FOLDER_LATAR_SHARE } from '@/lib/share-latar';

export const dynamic = 'force-dynamic';

const JENIS_BERKAS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun) && !akunManager(s.akun)) return galat('Hanya admin atau Manager PTS yang bisa mengganti latar.', 403);

  const form = await request.formData().catch(() => null);
  const berkas = form?.get('berkas');
  if (!(berkas instanceof File)) return galat('Pilih gambar dulu.');
  const ext = JENIS_BERKAS[berkas.type];
  if (!ext) return galat('Gambarnya harus PNG, JPG, atau WebP.');
  if (berkas.size > BATAS_LATAR_SHARE) {
    return galat(`Ukurannya ${(berkas.size / 1048576).toFixed(1)} MB, batasnya ${BATAS_LATAR_SHARE / 1048576} MB.`);
  }

  const nama = `${FOLDER_LATAR_SHARE}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  const { error } = await s.db.storage.from(BUCKET_LATAR_SHARE).upload(nama, Buffer.from(await berkas.arrayBuffer()), {
    contentType: berkas.type, cacheControl: '31536000', upsert: false,
  });
  if (error) return galat(`Unggah gagal: ${error.message}`, 500);
  return NextResponse.json({ url: s.db.storage.from(BUCKET_LATAR_SHARE).getPublicUrl(nama).data.publicUrl }, { headers: NO_STORE });
}
