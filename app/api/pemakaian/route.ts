/**
 * /api/pemakaian - catatan pemakaian menu (tabel pemakaian_menu, migrasi 058).
 *   POST { modul, sub? } -> catat satu kali modul dibuka oleh pemanggil (semua akun yang masuk)
 *   GET  ?hari=7|30|90   -> ringkasan (lib/pemakaian.ts ringkasPemakaian) - HANYA admin & Full Access,
 *                            karena isinya aktivitas rekan kerja. Peran dibaca ulang dari tabel users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { hasFullAccess } from '@/lib/constants';
import { modulSah, ringkasPemakaian, subSah, type AkunPemakaian, type BarisPemakaian } from '@/lib/pemakaian';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const HARI_SAH = [7, 30, 90];
const HALAMAN = 1000;
const MAKS_BARIS = 50_000;

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false }, { status: jaga.status });
  const body = await req.json().catch(() => null) as { modul?: unknown; sub?: unknown } | null;
  const modul = body?.modul;
  if (!modulSah(modul) || !subSah(modul, body?.sub)) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await getAdminClient().from('pemakaian_menu')
    .insert({ user_id: jaga.user.id, modul, sub: body?.sub ? String(body.sub) : null });
  //  Tabel belum ada / gagal tulis tidak boleh terlihat sebagai galat di layar pengguna.
  if (error) console.error('pemakaian: gagal mencatat', error.message);
  return NextResponse.json({ ok: !error }, { headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  const db = getAdminClient();
  const { data: saya } = await db.from('users').select('role, access_level').eq('id', jaga.user.id).maybeSingle();
  if (!hasFullAccess(saya as { role?: string; access_level?: string } | null)) {
    return NextResponse.json({ error: 'Pemakaian hanya untuk admin & akun Full Access.' }, { status: 403 });
  }

  const hari = HARI_SAH.includes(Number(req.nextUrl.searchParams.get('hari'))) ? Number(req.nextUrl.searchParams.get('hari')) : 30;
  const sejak = new Date(Date.now() - hari * 86_400_000).toISOString();

  //  PostgREST membatasi 1000 baris per permintaan - diambil per halaman.
  const baris: BarisPemakaian[] = [];
  for (let dari = 0; dari < MAKS_BARIS; dari += HALAMAN) {
    const { data, error } = await db.from('pemakaian_menu').select('user_id, modul, sub, created_at')
      .gte('created_at', sejak).order('id', { ascending: true }).range(dari, dari + HALAMAN - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    baris.push(...(data as BarisPemakaian[]));
    if (!data || data.length < HALAMAN) break;
  }

  const { data: akun, error: e2 } = await db.from('users').select('id, full_name, username, role, team_type');
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const { data: pertama } = await db.from('pemakaian_menu').select('created_at').order('id', { ascending: true }).limit(1);
  return NextResponse.json({
    hari,
    mulaiDicatat: (pertama?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
    ...ringkasPemakaian(baris, (akun ?? []) as AkunPemakaian[]),
  }, { headers: NO_STORE });
}
