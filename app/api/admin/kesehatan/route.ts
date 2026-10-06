import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { kumpulkanKesehatan } from '@/lib/kesehatan-server';
import { ringkasKesehatan } from '@/lib/kesehatan';

export const dynamic = 'force-dynamic';

/**
 * /api/admin/kesehatan - ringkasan kesehatan sistem untuk Admin Panel -> Sistem.
 *
 * Satu tempat untuk hal yang dulu hanya kelihatan lewat SQL Editor / dashboard Vercel:
 * ukuran DB & storage vs batas paket Free, cron (Vercel & pg_cron) terakhir jalan,
 * trigger yang memanggil HTTP keluar, fungsi berisi rahasia tertulis, pemakaian AI & WA.
 * Hanya baca. Admin saja (pastikanAdmin), data dibaca dengan service role.
 */
export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const data = await kumpulkanKesehatan(getAdminClient());
  return NextResponse.json({ ok: true, data, peringatan: ringkasKesehatan(data, Date.now()) });
}
