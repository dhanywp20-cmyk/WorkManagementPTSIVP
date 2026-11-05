import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set([
  'username', 'full_name', 'role', 'team_type', 'sales_division',
  'jabatan', 'phone_number', 'allowed_menus', 'allow_incentive_input', 'incentive_brand_scope', 'incentive_akses',
  'atasan_id', 'kpi_enabled', 'is_internal_sales', 'access_level', 'piket_akses', 'piket_ubah',
  'pimpinan',
  'bisa_ditugaskan',
  'pts_daerah',
]);

function pick(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj || {})) if (ALLOWED_FIELDS.has(k)) out[k] = obj[k];
  if (out.pimpinan === true) {
    out.atasan_id = null;
    out.kpi_enabled = false;
    out.bisa_ditugaskan = false;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getSessionUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
    }
    if (!isAdminRole(caller.role)) {
      return NextResponse.json({ error: 'Hanya admin yang boleh mengelola akun.' }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action as string;
    const supabase = getAdminClient();

    if (action === 'create') {
      const payload = pick(body.payload || {});
      if (!payload.username || !payload.full_name) {
        return NextResponse.json({ error: 'Username & nama wajib diisi.' }, { status: 400 });
      }
      const { data, error } = await supabase.from('users').insert([payload]).select('id').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ id: data?.id });
    }

    if (action === 'update') {
      const userId = body.userId as string;
      const payload = pick(body.payload || {});
      if (!userId) return NextResponse.json({ error: 'userId wajib.' }, { status: 400 });
      const { error } = await supabase.from('users').update(payload).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'setAccessLevel') {
      const userId = body.userId as string;
      const value = body.value === 'full' ? 'full' : 'guest';
      if (!userId) return NextResponse.json({ error: 'userId wajib.' }, { status: 400 });
      const { error } = await supabase.from('users').update({ access_level: value }).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 });
  }
}
