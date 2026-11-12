import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { POLA_ID, gagal, jumlahRuang, muatRequest, type Req } from '@/lib/request-desain/lampiran-server';
import { bolehUbahTautan, statusRuangan } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const namaRuang = (r: Req, idx: number) => (idx === 0 ? r.room_name : r.rooms?.[idx - 1]?.room_name)?.trim() || `Ruangan ${idx + 1}`;
const awalan = (r: Req, idx: number) => (idx > 0 ? `[${namaRuang(r, idx)}] ` : '');

async function catat(db: ReturnType<typeof getAdminClient>, r: Req, u: { id: string; full_name: string | null; role: string | null },
  pesan: string, aksi: 'create' | 'update' | 'delete', catatan: string) {
  await Promise.all([
    db.from('project_messages').insert({ request_id: r.id, sender_id: u.id, sender_name: u.full_name ?? '', sender_role: u.role ?? '', message: pesan }),
    db.from('audit_trail').insert({ user_id: u.id, user_name: u.full_name ?? '', action: aksi, module: 'project', target_id: r.id, target_name: r.project_name, notes: catatan }),
  ]).catch(() => {  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  const db = getAdminClient();
  const tautanId = req.nextUrl.searchParams.get('tautan');
  if (tautanId) {
    if (!POLA_ID.test(tautanId)) return gagal('Tautan tidak sah.');
    const { data: t, error: e1 } = await db.from('request_sld').select('versi, versi_id').eq('id', tautanId).eq('request_id', request.id).maybeSingle();
    if (e1) return gagal(e1.message, 500);
    if (!t) return gagal('Tautan tidak ditemukan.', 404);
    const { data: v, error: e2 } = await db.from('tools_sld_versi').select('nama, versi, data').eq('id', t.versi_id).maybeSingle();
    if (e2) return gagal(e2.message, 500);
    if (!v) return gagal('Versi SLD tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, sld: v }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  }
  const { data, error } = await db.from('request_sld')
    .select('id, room_idx, sld_id, versi, dilampirkan_oleh_nama, created_at, updated_at, snapshot:tools_sld_versi(nama, created_at, dibuat_oleh_nama), sumber:tools_sld(nama, versi, diarsipkan_at)')
    .eq('request_id', request.id).order('created_at', { ascending: true });
  if (error) return gagal(error.message, 500);
  const izin = Array.from({ length: jumlahRuang(request) }, (_, i) => bolehUbahTautan(user.role, statusRuangan(request, i)));
  return NextResponse.json({ ok: true, tautan: data ?? [], izin });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const sldId = String(b.sld_id ?? ''), roomIdx = Number(b.room_idx ?? 0);
  if (!POLA_ID.test(sldId)) return gagal('SLD tidak sah.');
  if (!Number.isInteger(roomIdx) || roomIdx < 0 || roomIdx >= jumlahRuang(request)) return gagal('Ruangan tidak sah.');
  const izin = bolehUbahTautan(user.role, statusRuangan(request, roomIdx));
  if (!izin.ok) return gagal(izin.alasan, 403);

  const db = getAdminClient();
  const { data: d } = await db.from('tools_sld').select('id, nama, versi, diarsipkan_at').eq('id', sldId).maybeSingle();
  if (!d) return gagal('SLD tidak ditemukan.', 404);
  if (d.diarsipkan_at) return gagal('SLD ini sudah diarsipkan.', 409);
  const { data: v } = await db.from('tools_sld_versi').select('id').eq('sld_id', d.id).eq('versi', d.versi).maybeSingle();
  if (!v) return gagal('Versi SLD tidak ditemukan. Simpan ulang SLD-nya di AV Solution Tools.', 409);

  const { data: baru, error } = await db.from('request_sld').insert({
    request_id: request.id, room_idx: roomIdx, sld_id: d.id, versi_id: v.id, versi: d.versi,
    dilampirkan_oleh: user.id, dilampirkan_oleh_nama: user.full_name ?? '',
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return gagal('SLD ini sudah ditautkan ke request ini.', 409);
    return gagal('Gagal menautkan SLD. Coba lagi.', 500);
  }
  const ruang = namaRuang(request, roomIdx);
  await catat(db, request, user, `${awalan(request, roomIdx)}📐 SLD (AV Solution Tools) ditautkan: ${d.nama} v${d.versi}`, 'create',
    `SLD ditautkan: ${d.nama} v${d.versi} (${ruang})`);
  return NextResponse.json({ ok: true, id: baru.id });
}

async function tautanBolehDiubah(db: ReturnType<typeof getAdminClient>, request: Req, role: string | null, tautanId: string) {
  if (!POLA_ID.test(tautanId)) return { galat: gagal('Tautan tidak sah.') };
  const { data: t } = await db.from('request_sld')
    .select('id, room_idx, sld_id, versi, sumber:tools_sld(nama, versi, diarsipkan_at)')
    .eq('id', tautanId).eq('request_id', request.id).maybeSingle();
  if (!t) return { galat: gagal('Tautan tidak ditemukan.', 404) };
  const izin = bolehUbahTautan(role, statusRuangan(request, t.room_idx));
  if (!izin.ok) return { galat: gagal(izin.alasan, 403) };
  const sumber = (Array.isArray(t.sumber) ? t.sumber[0] : t.sumber) as { nama: string; versi: number; diarsipkan_at: string | null } | null;
  return { t, sumber };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const db = getAdminClient();
  const x = await tautanBolehDiubah(db, request, user.role, String(b.tautan_id ?? ''));
  if ('galat' in x) return x.galat;
  const { t, sumber } = x;
  if (!sumber) return gagal('SLD sumber tidak ditemukan.', 404);
  if (sumber.diarsipkan_at) return gagal('SLD sumber sudah diarsipkan.', 409);
  if (sumber.versi === t.versi) return NextResponse.json({ ok: true, tetap: true });
  const { data: v } = await db.from('tools_sld_versi').select('id').eq('sld_id', t.sld_id).eq('versi', sumber.versi).maybeSingle();
  if (!v) return gagal('Versi terbaru tidak ditemukan.', 409);
  const { data: diubah, error } = await db.from('request_sld')
    .update({ versi_id: v.id, versi: sumber.versi, updated_at: new Date().toISOString() })
    .eq('id', t.id).eq('versi', t.versi).select('id');
  if (error) return gagal(error.message, 500);
  if (!diubah?.length) return gagal('Tautan baru saja diubah orang lain. Muat ulang.', 409);
  const ruang = namaRuang(request, t.room_idx);
  await catat(db, request, user, `${awalan(request, t.room_idx)}📐 SLD ${sumber.nama} diperbarui: v${t.versi} → v${sumber.versi}`, 'update',
    `SLD ${sumber.nama}: v${t.versi} -> v${sumber.versi} (${ruang})`);
  return NextResponse.json({ ok: true, versi: sumber.versi });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  const db = getAdminClient();
  const x = await tautanBolehDiubah(db, request, user.role, req.nextUrl.searchParams.get('tautan') ?? '');
  if ('galat' in x) return x.galat;
  const { t, sumber } = x;
  const { error } = await db.from('request_sld').delete().eq('id', t.id);
  if (error) return gagal(error.message, 500);
  const ruang = namaRuang(request, t.room_idx);
  await catat(db, request, user, `${awalan(request, t.room_idx)}📐 Tautan SLD dilepas: ${sumber?.nama ?? 'SLD'} v${t.versi}`, 'delete',
    `Tautan SLD dilepas: ${sumber?.nama ?? t.sld_id} v${t.versi} (${ruang}); SLD tetap di AV Solution Tools`);
  return NextResponse.json({ ok: true });
}
