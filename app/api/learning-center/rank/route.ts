import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { hitungPeringkat, type BarisAttempt } from '@/lib/learning-rank';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }

  const supabase = getAdminClient();

  const [attRes, usersRes] = await Promise.all([
    supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
    supabase.from('users').select('id, full_name, role, sales_division'),
  ]);

  if (attRes.error) return NextResponse.json({ error: attRes.error.message }, { status: 400 });
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });

  type BarisUser = { id: string; full_name: string | null; role: string | null; sales_division: string | null };
  const petaUser = new Map<string, BarisUser>();
  for (const u of (usersRes.data ?? []) as BarisUser[]) petaUser.set(u.id, u);

  type Baris = {
    id: string; quiz_session_id: string | null;
    user_id: string; score: number | null; grading_status: string | null;
    passed: boolean | null; tab_switches: number | null; time_taken_sec: number | null;
  };
  const diratakan: BarisAttempt[] = ((attRes.data ?? []) as Baris[]).map(a => {
    const u = petaUser.get(a.user_id);
    return {
      user_id: a.user_id, score: a.score, grading_status: a.grading_status,
      passed: a.passed, tab_switches: a.tab_switches, time_taken_sec: a.time_taken_sec,
      attempt_id: a.id, quiz_session_id: a.quiz_session_id,
      full_name: u?.full_name ?? null,
      role: u?.role ?? null, sales_division: u?.sales_division ?? null,
    };
  });

  const hasil = hitungPeringkat(diratakan, {
    id: caller.id, role: caller.role, sales_division: caller.sales_division,
  });

  return NextResponse.json(hasil, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
