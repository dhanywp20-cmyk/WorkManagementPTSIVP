import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/incentive/splits[?projectId=...]
 *
 * Mengembalikan pembagian incentive (incentive_splits) DENGAN filter privasi di
 * server — bukan di klien. Tabel ini berisi "siapa dapat berapa", data paling
 * sensitif. Setelah RLS dikunci (deny anon SELECT), inilah satu-satunya jalan
 * baca splits.
 *
 * - Admin / user dengan allow_incentive_input → lihat SEMUA.
 * - Selain itu → hanya baris milik dirinya sendiri (user_id == dia).
 */
export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }

  const supabase = getAdminClient();

  // Hak lihat penuh?
  let canSeeAll = isAdminRole(caller.role);
  if (!canSeeAll) {
    const { data: u } = await supabase
      .from('users').select('allow_incentive_input').eq('id', caller.id).maybeSingle();
    canSeeAll = !!u?.allow_incentive_input;
  }

  const projectId = request.nextUrl.searchParams.get('projectId');
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  if (!canSeeAll) q = q.eq('user_id', caller.id); // non-privileged → jatahnya sendiri saja

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}
