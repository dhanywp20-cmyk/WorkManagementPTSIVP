import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/incentive/set-nominal { reminderId, amount }
 *
 * Simpan nominal incentive proyek ke tabel terkunci incentive_amounts.
 * Hanya admin / allow_incentive_input yang boleh (sama seperti canInputNominal di UI).
 */
export async function POST(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });

  const supabase = getAdminClient();

  let allowed = isAdminRole(caller.role);
  if (!allowed) {
    const { data: u } = await supabase.from('users').select('allow_incentive_input').eq('id', caller.id).maybeSingle();
    allowed = !!u?.allow_incentive_input;
  }
  if (!allowed) return NextResponse.json({ error: 'Tidak berwenang input nominal.' }, { status: 403 });

  const { reminderId, amount } = await request.json();
  const amt = Number(amount);
  if (!reminderId || !Number.isFinite(amt) || amt < 0) {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('incentive_amounts')
    .upsert({ reminder_id: reminderId, amount: amt, updated_at: new Date().toISOString() }, { onConflict: 'reminder_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
