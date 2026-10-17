/**
 * /api/admin/kelas-eksternal/unggah - logo event & gambar latar Kuis Live, dan gambar soal Bank Soal.
 *  POST multipart { berkas, jenis:'logo'|'latar'|'soal' } -> { url }
 *
 * Lewat server (service role), bukan unggah langsung dari peramban: kebijakan tulis bucket
 * merek-files khusus pengaturan merek, sedangkan pengelola Kelas Eksternal & Bank Soal = admin / Full Access
 * (sama dengan policy tulis lc_questions). Semua masuk folder kuis-live/, jadi lolos rapikanUrlGambar.
 * Hanya PNG/JPG/WebP - SVG ditolak karena bisa membawa skrip.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { hasFullAccess } from '@/lib/constants';
import { FOLDER_GAMBAR } from '@/lib/kuis-live';

export const dynamic = 'force-dynamic';

const jawab = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const JENIS_BERKAS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
//  Di bawah batas badan permintaan Vercel (4,5 MB); gambar latar dikecilkan di peramban dulu.
const BATAS = { logo: 2 * 1024 * 1024, latar: 4 * 1024 * 1024, soal: 2 * 1024 * 1024 };

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return jawab({ error: jaga.alasan }, jaga.status);
  const db = getAdminClient();
  const { data: u } = await db.from('users').select('role,access_level').eq('id', jaga.user.id).maybeSingle();
  if (!hasFullAccess((u ?? {}) as { role?: string; access_level?: string })) return jawab({ error: 'Hanya admin Learning Center.' }, 403);

  const form = await req.formData().catch(() => null);
  const berkas = form?.get('berkas');
  const j = form?.get('jenis');
  const jenis = j === 'latar' || j === 'soal' ? j : 'logo';
  if (!(berkas instanceof File)) return jawab({ error: 'Pilih gambar dulu.' }, 400);
  const ext = JENIS_BERKAS[berkas.type];
  if (!ext) return jawab({ error: 'Gambarnya harus PNG, JPG, atau WebP.' }, 400);
  if (berkas.size > BATAS[jenis]) return jawab({ error: `Ukurannya ${(berkas.size / 1048576).toFixed(1)} MB, batasnya ${BATAS[jenis] / 1048576} MB.` }, 400);

  const nama = `${FOLDER_GAMBAR}/${jenis}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  const { error } = await db.storage.from('merek-files').upload(nama, Buffer.from(await berkas.arrayBuffer()), {
    contentType: berkas.type, cacheControl: '31536000', upsert: false,
  });
  if (error) return jawab({ error: `Unggah gagal: ${error.message}` }, 500);
  return jawab({ url: db.storage.from('merek-files').getPublicUrl(nama).data.publicUrl });
}
