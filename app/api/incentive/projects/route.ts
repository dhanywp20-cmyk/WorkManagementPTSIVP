import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'];

/**
 * GET /api/incentive/projects
 *
 * Daftar proyek incentive (reminders kategori incentive, status done) DENGAN
 * nominal (incentive_value) ditempelkan dari tabel terkunci incentive_amounts.
 * Filter privasi server-side: admin / allow_incentive_input → nominal asli;
 * lainnya → 0 (tersembunyi). Mengganti baca langsung reminders.incentive_value.
 */
export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });

  const supabase = getAdminClient();

  let canSeeAll = isAdminRole(caller.role);
  if (!canSeeAll) {
    const { data: u } = await supabase.from('users').select('allow_incentive_input').eq('id', caller.id).maybeSingle();
    canSeeAll = !!u?.allow_incentive_input;
  }

  const [projRes, amtRes] = await Promise.all([
    supabase.from('reminders').select('*').in('category', INCENTIVE_CATEGORIES).eq('status', 'done').order('due_date', { ascending: false }),
    supabase.from('incentive_amounts').select('reminder_id, amount'),
  ]);
  if (projRes.error) return NextResponse.json({ error: projRes.error.message }, { status: 400 });

  const amtMap = new Map<string, number>((amtRes.data ?? []).map((r: { reminder_id: string; amount: number }) => [r.reminder_id, Number(r.amount) || 0]));
  const projects = (projRes.data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    incentive_value: canSeeAll ? (amtMap.get(p.id as string) ?? 0) : 0,
  }));

  return NextResponse.json({ data: projects, canSeeAll });
}
