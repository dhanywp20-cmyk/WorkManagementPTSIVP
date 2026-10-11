/**
 * /api/tools-team/perbandingan/aturan - aturan Product Comparison untuk Admin Panel (lib/perbandingan-aturan.ts).
 *   GET   Admin: aturan sekarang (bawaan bila belum diisi).
 *   PUT   Admin: simpan aturan (dirapikan - isian tak dikenal dibuang, Admin selalu verifikator).
 * Disimpan di app_settings 'tools.perbandingan' lewat service role.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { KUNCI_ATURAN_PERBANDINGAN, rapikanAturan } from '@/lib/perbandingan-aturan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const { data } = await getAdminClient().from('app_settings').select('value').eq('key', KUNCI_ATURAN_PERBANDINGAN).maybeSingle();
  return NextResponse.json({ ok: true, aturan: rapikanAturan(data?.value), tersimpan: !!data });
}

export async function PUT(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return gagal('Format aturan tidak sah.');
  const aturan = rapikanAturan(body);
  const { error } = await getAdminClient().from('app_settings')
    .upsert({ key: KUNCI_ATURAN_PERBANDINGAN, value: aturan, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return gagal('Gagal menyimpan aturan.', 500);
  return NextResponse.json({ ok: true, aturan });
}
