/**
 * /api/android/unduh - unduh APK rilis terbaru (atau ?kode=N). Sesi wajib;
 * dialihkan ke signed URL Supabase berumur 10 menit, jadi berkasnya tidak
 * pernah publik dan tidak lewat bandwidth Vercel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const db = getAdminClient();
  const kode = Number(req.nextUrl.searchParams.get('kode'));
  let q = db.from('rilis_android').select('versi, path').not('path', 'is', null);
  q = Number.isInteger(kode) && kode > 0 ? q.eq('kode_versi', kode) : q.order('kode_versi', { ascending: false });
  const { data } = await q.limit(1).maybeSingle();
  if (!data?.path) return NextResponse.json({ ok: false, alasan: 'Belum ada rilis APK.' }, { status: 404 });

  const { data: url, error } = await db.storage.from('aplikasi-android')
    .createSignedUrl(data.path, 600, { download: `work-management-v${data.versi}.apk` });
  if (error || !url) return NextResponse.json({ ok: false, alasan: error?.message ?? 'Gagal membuat tautan.' }, { status: 500 });
  return NextResponse.redirect(url.signedUrl, 302);
}
