import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/project-progress/share/<token>
 *
 * Endpoint PUBLIK (tanpa session) untuk link share View-Only. Dipakai halaman
 * /project-progress/share/<token>.
 *
 * Keamanan:
 *  - Memakai service_role di server, sehingga tabel progress_* TIDAK perlu
 *    dibuka ke anon key yang ikut ter-bundle di browser.
 *  - Token dicari dengan .eq() persis; token salah → 404, tidak bocor apa pun.
 *  - share_enabled = false → 404 juga, jadi link bisa dimatikan tanpa perlu
 *    mengganti token.
 *  - Hanya READ. Tidak ada jalur tulis di sini.
 *  - Kolom yang dikembalikan dipilih eksplisit; share_token tidak ikut keluar.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = (params.token ?? '').trim();
  // Token dibuat 32 hex char (lihat newShareToken). Tolak lebih awal supaya
  // string aneh tidak sampai ke query.
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return NextResponse.json({ error: 'Link tidak valid.' }, { status: 404 });
  }

  const supabase = getAdminClient();

  const { data: project, error: pErr } = await supabase
    .from('progress_projects')
    .select('id,name,client,description,status,share_enabled,created_at,updated_at')
    .eq('share_token', token)
    .maybeSingle();

  if (pErr || !project || !project.share_enabled) {
    return NextResponse.json({ error: 'Link tidak ditemukan atau sudah dinonaktifkan.' }, { status: 404 });
  }

  const [locRes, issueRes] = await Promise.all([
    supabase.from('progress_locations')
      .select('id,project_id,name,pic,status,progress,note,note_flag,sort_order,created_at')
      .eq('project_id', project.id).order('sort_order'),
    supabase.from('progress_issues')
      .select('id,project_id,location_label,issue,severity,note,sort_order,created_at')
      .eq('project_id', project.id).order('sort_order'),
  ]);

  const locations = locRes.data ?? [];
  const locationIds = locations.map((l: { id: string }) => l.id);

  // Komponen hanya diambil bila ada lokasi — .in() dengan array kosong
  // menghasilkan query yang tidak perlu.
  let componentsData: unknown[] = [];
  if (locationIds.length > 0) {
    const { data } = await supabase
      .from('progress_components')
      .select('id,location_id,label,state,sort_order,created_at')
      .in('location_id', locationIds)
      .order('sort_order');
    componentsData = data ?? [];
  }

  return NextResponse.json({
    // share_token & created_by sengaja tidak dikirim ke halaman publik.
    project: {
      ...project,
      share_token: null,
      created_by: null,
    },
    locations,
    components: componentsData,
    issues: issueRes.data ?? [],
  });
}
