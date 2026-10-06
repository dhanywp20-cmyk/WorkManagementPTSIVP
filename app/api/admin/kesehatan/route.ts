import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { KUNCI_CRON_TERAKHIR, type JejakCron } from '@/lib/cron-catat';
import { ringkasKesehatan, type DataKesehatan } from '@/lib/kesehatan';

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
  const db = getAdminClient();
  const sejak24 = new Date(Date.now() - 86_400_000).toISOString();
  const sejak7h = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [rpc, jejak, ai24, ai7, wa24, rilis, pengaturan] = await Promise.all([
    db.rpc('kesehatan_sistem'),
    db.from('app_settings').select('value').eq('key', KUNCI_CRON_TERAKHIR).maybeSingle(),
    db.from('ai_pakai_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak24),
    db.from('ai_pakai_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak7h),
    db.from('wa_kirim_log').select('*', { count: 'exact', head: true }).gte('created_at', sejak24),
    db.from('rilis_android').select('versi, diunggah_pada').order('diunggah_pada', { ascending: false }).limit(1),
    bacaPengaturan(true).catch(() => null),
  ]);

  const data: DataKesehatan = {
    sistem: rpc.error ? null : (rpc.data as DataKesehatan['sistem']),
    sqlBelum: !!rpc.error,
    cronVercel: ((jejak.data?.value ?? {}) as JejakCron),
    ai: { jam24: ai24.count ?? 0, hari7: ai7.count ?? 0 },
    waJam24: wa24.count ?? 0,
    apkTerakhir: rilis.data?.[0] ?? null,
    kanal: pengaturan?.aktif ?? null,
    env: {
      serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      cronSecret: !!process.env.CRON_SECRET,
    },
  };
  return NextResponse.json({ ok: true, data, peringatan: ringkasKesehatan(data, Date.now()) });
}
