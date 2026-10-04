/**
 * /api/form-require-project/[id]/desain-3d - Design 3D dari Tools Team yang
 * ditautkan ke ruangan sebuah Request Design Project.
 *
 * TAMBAHAN di samping unggahan file "Design 3D" (PDF) yang sudah ada - dua
 * jalur itu hidup berdampingan dan keduanya opsional. Request tanpa tautan
 * tetap sah untuk dibuat, dikerjakan, dicetak, dan diunduh.
 *
 *   GET                       tautan semua ruangan (ringkasan + pratinjau versi
 *                             yang ditautkan, bukan data 3D) + izin per ruangan.
 *   POST   {desain_id, room_idx}  tautkan VERSI TERBARU desain itu.
 *   PATCH  {tautan_id}        pindahkan tautan ke versi terbaru (eksplisit).
 *   DELETE ?tautan=           lepas tautan. Desain di Tools Team tidak disentuh.
 *
 * Hak lihat = RLS project_requests milik pengguna itu sendiri (query dengan
 * token pengguna, bukan service role). Hak ubah = bolehUbahTautan(): tim PTS,
 * ruangan sudah diterima & belum Completed. Tautan merujuk baris versi yang
 * tidak pernah diubah, jadi mengedit desain di Tools Team tidak mengubah
 * request diam-diam.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { muatUser, klienSebagaiUser } from '@/lib/ai-server';
import { bolehUbahTautan, statusRuangan } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLA_ID = /^[0-9a-f-]{36}$/i;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Req = { id: string; project_name: string; room_name: string | null; status: string; rooms: { room_name?: string; status?: string }[] | null };

/** Request yang BOLEH dilihat pemanggil (RLS miliknya), plus perannya. */
async function muatRequest(req: NextRequest, id: string) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return { galat: gagal(jaga.alasan, jaga.status) };
  if (!POLA_ID.test(id)) return { galat: gagal('ID request tidak sah.') };
  const user = await muatUser(jaga.user.id);
  if (!user) return { galat: gagal('Akun tidak ditemukan.', 401) };
  const { data } = await klienSebagaiUser(user).from('project_requests')
    .select('id, project_name, room_name, status, rooms').eq('id', id).maybeSingle();
  if (!data) return { galat: gagal('Request tidak ditemukan atau Anda tidak punya akses.', 404) };
  return { user, request: data as Req };
}

const namaRuang = (r: Req, idx: number) => (idx === 0 ? r.room_name : r.rooms?.[idx - 1]?.room_name)?.trim() || `Ruangan ${idx + 1}`;
const jumlahRuang = (r: Req) => 1 + (r.rooms?.length ?? 0);
/** Awalan pesan per ruangan, sama dengan konvensi halaman: Ruangan 1 tanpa awalan. */
const awalan = (r: Req, idx: number) => (idx > 0 ? `[${namaRuang(r, idx)}] ` : '');

/** Catatan di riwayat percakapan request (seperti unggahan SLD/BOQ) + audit trail. */
async function catat(db: ReturnType<typeof getAdminClient>, r: Req, u: { id: string; full_name: string | null; role: string | null },
  pesan: string, aksi: 'create' | 'update' | 'delete', catatan: string) {
  await Promise.all([
    db.from('project_messages').insert({ request_id: r.id, sender_id: u.id, sender_name: u.full_name ?? '', sender_role: u.role ?? '', message: pesan }),
    db.from('audit_trail').insert({ user_id: u.id, user_name: u.full_name ?? '', action: aksi, module: 'project', target_id: r.id, target_name: r.project_name, notes: catatan }),
  ]).catch(() => { /* catatan tidak boleh menggagalkan aksi utama */ });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  const db = getAdminClient();
  const { data, error } = await db.from('request_desain_ruang')
    .select('id, room_idx, desain_id, versi, dilampirkan_oleh_nama, created_at, updated_at, snapshot:tools_desain_ruang_versi(nama, ringkasan, gambar, created_at, dibuat_oleh_nama), sumber:tools_desain_ruang(nama, versi, diarsipkan_at)')
    .eq('request_id', request.id).order('created_at', { ascending: true });
  if (error) return gagal(error.message, 500);
  const izin = Array.from({ length: jumlahRuang(request) }, (_, i) => bolehUbahTautan(user.role, statusRuangan(request, i)));
  return NextResponse.json({ ok: true, tautan: data ?? [], izin });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const desainId = String(b.desain_id ?? ''), roomIdx = Number(b.room_idx ?? 0);
  if (!POLA_ID.test(desainId)) return gagal('Desain tidak sah.');
  if (!Number.isInteger(roomIdx) || roomIdx < 0 || roomIdx >= jumlahRuang(request)) return gagal('Ruangan tidak sah.');
  const izin = bolehUbahTautan(user.role, statusRuangan(request, roomIdx));
  if (!izin.ok) return gagal(izin.alasan, 403);

  const db = getAdminClient();
  const { data: d } = await db.from('tools_desain_ruang').select('id, nama, versi, diarsipkan_at').eq('id', desainId).maybeSingle();
  if (!d) return gagal('Desain tidak ditemukan.', 404);
  if (d.diarsipkan_at) return gagal('Desain ini sudah diarsipkan.', 409);
  const { data: v } = await db.from('tools_desain_ruang_versi').select('id').eq('desain_id', d.id).eq('versi', d.versi).maybeSingle();
  if (!v) return gagal('Versi desain tidak ditemukan. Simpan ulang desainnya di Tools Team.', 409);

  const { data: baru, error } = await db.from('request_desain_ruang').insert({
    request_id: request.id, room_idx: roomIdx, desain_id: d.id, versi_id: v.id, versi: d.versi,
    dilampirkan_oleh: user.id, dilampirkan_oleh_nama: user.full_name ?? '',
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return gagal('Desain ini sudah ditautkan ke request ini.', 409);
    return gagal('Gagal menautkan Design 3D. Coba lagi.', 500);
  }
  const ruang = namaRuang(request, roomIdx);
  await catat(db, request, user, `${awalan(request, roomIdx)}🧊 Design 3D (Tools Team) ditautkan: ${d.nama} v${d.versi}`, 'create',
    `Design 3D ditautkan: ${d.nama} v${d.versi} (${ruang})`);
  return NextResponse.json({ ok: true, id: baru.id });
}

/** Ambil tautan milik request ini + cek izin ruangannya. */
async function tautanBolehDiubah(db: ReturnType<typeof getAdminClient>, request: Req, role: string | null, tautanId: string) {
  if (!POLA_ID.test(tautanId)) return { galat: gagal('Tautan tidak sah.') };
  const { data: t } = await db.from('request_desain_ruang')
    .select('id, room_idx, desain_id, versi, sumber:tools_desain_ruang(nama, versi, diarsipkan_at)')
    .eq('id', tautanId).eq('request_id', request.id).maybeSingle();
  if (!t) return { galat: gagal('Tautan tidak ditemukan.', 404) };
  const izin = bolehUbahTautan(role, statusRuangan(request, t.room_idx));
  if (!izin.ok) return { galat: gagal(izin.alasan, 403) };
  const sumber = (Array.isArray(t.sumber) ? t.sumber[0] : t.sumber) as { nama: string; versi: number; diarsipkan_at: string | null } | null;
  return { t, sumber };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const db = getAdminClient();
  const x = await tautanBolehDiubah(db, request, user.role, String(b.tautan_id ?? ''));
  if ('galat' in x) return x.galat;
  const { t, sumber } = x;
  if (!sumber) return gagal('Desain sumber tidak ditemukan.', 404);
  if (sumber.diarsipkan_at) return gagal('Desain sumber sudah diarsipkan.', 409);
  if (sumber.versi === t.versi) return NextResponse.json({ ok: true, tetap: true });
  const { data: v } = await db.from('tools_desain_ruang_versi').select('id').eq('desain_id', t.desain_id).eq('versi', sumber.versi).maybeSingle();
  if (!v) return gagal('Versi terbaru tidak ditemukan.', 409);
  //  Hanya berhasil bila tautannya masih di versi yang dilihat pengguna (tidak ada yang mendahului).
  const { data: diubah, error } = await db.from('request_desain_ruang')
    .update({ versi_id: v.id, versi: sumber.versi, updated_at: new Date().toISOString() })
    .eq('id', t.id).eq('versi', t.versi).select('id');
  if (error) return gagal(error.message, 500);
  if (!diubah?.length) return gagal('Tautan baru saja diubah orang lain. Muat ulang.', 409);
  const ruang = namaRuang(request, t.room_idx);
  await catat(db, request, user, `${awalan(request, t.room_idx)}🧊 Design 3D ${sumber.nama} diperbarui: v${t.versi} → v${sumber.versi}`, 'update',
    `Design 3D ${sumber.nama}: v${t.versi} -> v${sumber.versi} (${ruang})`);
  return NextResponse.json({ ok: true, versi: sumber.versi });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await muatRequest(req, params.id);
  if ('galat' in m) return m.galat;
  const { user, request } = m;
  const db = getAdminClient();
  const x = await tautanBolehDiubah(db, request, user.role, req.nextUrl.searchParams.get('tautan') ?? '');
  if ('galat' in x) return x.galat;
  const { t, sumber } = x;
  const { error } = await db.from('request_desain_ruang').delete().eq('id', t.id);
  if (error) return gagal(error.message, 500);
  const ruang = namaRuang(request, t.room_idx);
  await catat(db, request, user, `${awalan(request, t.room_idx)}🧊 Tautan Design 3D dilepas: ${sumber?.nama ?? 'desain'} v${t.versi}`, 'delete',
    `Tautan Design 3D dilepas: ${sumber?.nama ?? t.desain_id} v${t.versi} (${ruang}); desain tetap di Tools Team`);
  return NextResponse.json({ ok: true });
}
