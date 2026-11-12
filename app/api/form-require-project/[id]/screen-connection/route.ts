import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { POLA_ID, gagal, jumlahRuang, muatRequest, type Req } from '@/lib/request-desain/lampiran-server';
import { bersihkanSvgKoneksi, bolehUbahTautan, statusRuangan } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'request_screen_connection';
const PESAN_TANPA_GAMBAR = 'Hitungan LED ini belum menyimpan gambar Screen Connection. Buka di AV Solution Tools → LED Videotron, lalu simpan ulang.';

type Db = ReturnType<typeof getAdminClient>;

const namaRuang = (r: Req, idx: number) => (idx === 0 ? r.room_name : r.rooms?.[idx - 1]?.room_name)?.trim() || `Ruangan ${idx + 1}`;
const awalan = (r: Req, idx: number) => (idx > 0 ? `[${namaRuang(r, idx)}] ` : '');
const izinUbah = (role: string | null, r: Req, idx: number) => {
  const izin = bolehUbahTautan(role, statusRuangan(r, idx));
  return izin.ok ? izin : { ok: false as const, alasan: izin.alasan.replace('Design 3D', 'Screen Connection') };
};

async function catat(db: Db, r: Req, u: { id: string; full_name: string | null; role: string | null },
  pesan: string, aksi: 'create' | 'update' | 'delete', catatan: string) {
  await Promise.all([
    db.from('project_messages').insert({ request_id: r.id, sender_id: u.id, sender_name: u.full_name ?? '', sender_role: u.role ?? '', message: pesan }),
    db.from('audit_trail').insert({ user_id: u.id, user_name: u.full_name ?? '', action: aksi, module: 'project', target_id: r.id, target_name: r.project_name, notes: catatan }),
  ]).catch(() => {  });
}

async function muatSumber(db: Db, ledId: string) {
  const { data } = await db.from('tools_led_simpan').select('id, nama, svg_koneksi, updated_at').eq('id', ledId).maybeSingle();
  return data as { id: string; nama: string; svg_koneksi: string | null; updated_at: string } | null;
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
    const { data, error } = await db.from(TABEL).select('svg').eq('id', tautanId).eq('request_id', request.id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Tautan tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, svg: data.svg }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  }
  const { data, error } = await db.from(TABEL)
    .select('id, room_idx, led_id, nama, sumber_diubah_at, dilampirkan_oleh_nama, created_at, updated_at, sumber:tools_led_simpan(nama, updated_at)')
    .eq('request_id', request.id).order('created_at', { ascending: true });
  if (error) return gagal(error.message, 500);
  const izin = Array.from({ length: jumlahRuang(request) }, (_, i) => izinUbah(user.role, request, i));
  return NextResponse.json({ ok: true, tautan: data ?? [], izin });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const ledId = String(b.led_id ?? ''), roomIdx = Number(b.room_idx ?? 0);
  if (!POLA_ID.test(ledId)) return gagal('Hitungan LED tidak sah.');
  if (!Number.isInteger(roomIdx) || roomIdx < 0 || roomIdx >= jumlahRuang(request)) return gagal('Ruangan tidak sah.');
  const izin = izinUbah(user.role, request, roomIdx);
  if (!izin.ok) return gagal(izin.alasan, 403);

  const db = getAdminClient();
  const sumber = await muatSumber(db, ledId);
  if (!sumber) return gagal('Hitungan LED tidak ditemukan.', 404);
  const svg = bersihkanSvgKoneksi(sumber.svg_koneksi);
  if (!svg) return gagal(PESAN_TANPA_GAMBAR, 409);

  const { data: baru, error } = await db.from(TABEL).insert({
    request_id: request.id, room_idx: roomIdx, led_id: sumber.id, nama: sumber.nama.slice(0, 160), svg, sumber_diubah_at: sumber.updated_at,
    dilampirkan_oleh: user.id, dilampirkan_oleh_nama: user.full_name ?? '',
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return gagal('Screen Connection ini sudah ditautkan ke ruangan ini.', 409);
    return gagal('Gagal menautkan Screen Connection. Coba lagi.', 500);
  }
  await catat(db, request, user, `${awalan(request, roomIdx)}🖥️ Screen Connection (AV Solution Tools) ditautkan: ${sumber.nama}`, 'create',
    `Screen Connection ditautkan: ${sumber.nama} (${namaRuang(request, roomIdx)})`);
  return NextResponse.json({ ok: true, id: baru.id });
}

async function muatTautan(db: Db, request: Req, role: string | null, tautanId: string) {
  if (!POLA_ID.test(tautanId)) return { galat: gagal('Tautan tidak sah.') };
  const { data: t } = await db.from(TABEL).select('id, room_idx, led_id, nama, sumber_diubah_at')
    .eq('id', tautanId).eq('request_id', request.id).maybeSingle();
  if (!t) return { galat: gagal('Tautan tidak ditemukan.', 404) };
  const izin = izinUbah(role, request, t.room_idx);
  if (!izin.ok) return { galat: gagal(izin.alasan, 403) };
  return { t: t as { id: string; room_idx: number; led_id: string | null; nama: string; sumber_diubah_at: string | null } };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const db = getAdminClient();
  const x = await muatTautan(db, request, user.role, String(b.tautan_id ?? ''));
  if ('galat' in x) return x.galat;
  const { t } = x;
  if (!t.led_id) return gagal('Hitungan LED sumber sudah dihapus - gambar yang tertaut tetap tersimpan.', 409);
  const sumber = await muatSumber(db, t.led_id);
  if (!sumber) return gagal('Hitungan LED sumber tidak ditemukan.', 404);
  const svg = bersihkanSvgKoneksi(sumber.svg_koneksi);
  if (!svg) return gagal(PESAN_TANPA_GAMBAR, 409);
  if (t.sumber_diubah_at && sumber.updated_at === t.sumber_diubah_at) return NextResponse.json({ ok: true, tetap: true });
  const { data: diubah, error } = await db.from(TABEL)
    .update({ nama: sumber.nama.slice(0, 160), svg, sumber_diubah_at: sumber.updated_at, updated_at: new Date().toISOString() })
    .eq('id', t.id).select('id');
  if (error) return gagal(error.message, 500);
  if (!diubah?.length) return gagal('Tautan baru saja diubah orang lain. Muat ulang.', 409);
  await catat(db, request, user, `${awalan(request, t.room_idx)}🖥️ Screen Connection ${sumber.nama} diperbarui ke versi terbaru`, 'update',
    `Screen Connection ${sumber.nama} diperbarui (${namaRuang(request, t.room_idx)})`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  const db = getAdminClient();
  const x = await muatTautan(db, request, user.role, req.nextUrl.searchParams.get('tautan') ?? '');
  if ('galat' in x) return x.galat;
  const { t } = x;
  const { error } = await db.from(TABEL).delete().eq('id', t.id);
  if (error) return gagal(error.message, 500);
  await catat(db, request, user, `${awalan(request, t.room_idx)}🖥️ Tautan Screen Connection dilepas: ${t.nama}`, 'delete',
    `Tautan Screen Connection dilepas: ${t.nama} (${namaRuang(request, t.room_idx)}); hitungan tetap di AV Solution Tools`);
  return NextResponse.json({ ok: true });
}
