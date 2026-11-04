import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { kumpulkanKesehatan } from '@/lib/kesehatan-server';
import { ringkasKesehatan } from '@/lib/kesehatan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const data = await kumpulkanKesehatan(getAdminClient());
  return NextResponse.json({ ok: true, data, peringatan: ringkasKesehatan(data, Date.now()) });
}
