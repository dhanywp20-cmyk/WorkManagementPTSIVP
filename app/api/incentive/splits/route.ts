import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/auth/server';
import { bisaInputNominal, bisaKonfigPenuh } from '@/lib/incentive/akses';

export const dynamic = 'force-dynamic';

async function pemanggil(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return null;
  const supabase = getAdminClient();
  const { data: row } = await supabase
    .from('users').select('incentive_akses, allow_incentive_input, access_level').eq('id', caller.id).maybeSingle();
  return { caller, supabase, hak: { role: caller.role, ...(row ?? {}) } };
}

export async function GET(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  const { caller, supabase, hak } = p;

  const projectId = request.nextUrl.searchParams.get('projectId');
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  if (!bisaInputNominal(hak)) q = q.eq('user_id', caller.id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  const { supabase, hak } = p;

  const projectId = request.nextUrl.searchParams.get('projectId');
  const trancheIds = (request.nextUrl.searchParams.get('trancheIds') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!projectId && trancheIds.length === 0) {
    return NextResponse.json({ error: 'Sebutkan trancheIds atau projectId.' }, { status: 400 });
  }
  const cukup = projectId ? bisaKonfigPenuh(hak) : bisaInputNominal(hak);
  if (!cukup) return NextResponse.json({ error: 'Akses Anda tidak cukup untuk menghapus pembagian.' }, { status: 403 });

  let qt = supabase.from('incentive_tranches').select('id, status');
  qt = projectId ? qt.eq('project_id', projectId) : qt.in('id', trancheIds);
  const { data: tr, error: trErr } = await qt;
  if (trErr) return NextResponse.json({ error: trErr.message }, { status: 400 });

  const baris = (tr ?? []) as { id: string; status: string }[];
  const paid = baris.filter(t => t.status === 'paid').length;

  if (projectId) {
    if (paid > 0) {
      return NextResponse.json({ error: `Proyek ini punya ${paid} tahapan berstatus Paid — pembagiannya tidak boleh dihapus.` }, { status: 409 });
    }
    const { data: hapus, error } = await supabase
      .from('incentive_splits').delete().eq('project_id', projectId).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ dihapus: (hapus ?? []).length, dilewati: 0 });
  }

  const sasaran = baris.filter(t => t.status !== 'paid').map(t => t.id);
  if (sasaran.length === 0) return NextResponse.json({ dihapus: 0, dilewati: paid });

  const { data: hapus, error } = await supabase
    .from('incentive_splits').delete().in('tranche_id', sasaran).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ dihapus: (hapus ?? []).length, dilewati: paid, trancheIds: sasaran });
}
