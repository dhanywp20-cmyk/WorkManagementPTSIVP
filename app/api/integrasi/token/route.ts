/**
 * /api/integrasi/token - pemilik akun mengelola token DIWAYPI-nya sendiri (sesi cookie).
 *   GET    -> daftar token milik pemanggil (tanpa nilai token; hanya 4 huruf terakhir)
 *   POST   -> { nama, tulis } -> token baru, DITAMPILKAN SEKALI
 *   DELETE -> ?id=<uuid> -> cabut (bukan hapus: jejaknya tetap)
 *
 * Token hanya bisa dibuat untuk akun pemanggil sendiri - tidak ada parameter user_id.
 * GET & POST hanya admin & akun Full Access (bolehDiwaypiDan2FA); DELETE terbuka untuk pemilik
 * token supaya akun yang haknya dicabut tetap bisa membersihkan tokennya sendiri.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAksesPenuh, pastikanMasuk } from '@/lib/penjaga-admin';
import { MAKS_TOKEN_PER_USER, buatTokenMentah, hashToken, namaSah } from '@/lib/token-integrasi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const PESAN_KHUSUS = 'Integrasi DIWAYPI hanya untuk admin & akun yang ditunjuk.';

export async function GET(req: NextRequest) {
  const jaga = await pastikanAksesPenuh(req, PESAN_KHUSUS);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  const { data, error } = await getAdminClient().from('token_integrasi')
    .select('id, nama, akhiran, cakupan, dibuat, terakhir_dipakai, dicabut')
    .eq('user_id', jaga.user.id).order('dibuat', { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data ?? [] }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAksesPenuh(req, PESAN_KHUSUS);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  let body: { nama?: unknown; tulis?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Permintaan tidak terbaca.' }, { status: 400 }); }
  const nama = namaSah(body.nama) ?? 'DIWAYPI';

  const db = getAdminClient();
  const { count } = await db.from('token_integrasi').select('id', { count: 'exact', head: true })
    .eq('user_id', jaga.user.id).is('dicabut', null);
  if ((count ?? 0) >= MAKS_TOKEN_PER_USER) {
    return NextResponse.json({ error: `Maksimal ${MAKS_TOKEN_PER_USER} token aktif. Cabut yang tidak dipakai dulu.` }, { status: 400 });
  }
  const token = buatTokenMentah();
  const cakupan = body.tulis === true ? ['baca', 'tulis'] : ['baca'];
  const { data, error } = await db.from('token_integrasi').insert([{
    user_id: jaga.user.id, nama, token_hash: hashToken(token), akhiran: token.slice(-4), cakupan,
  }]).select('id, nama, akhiran, cakupan, dibuat').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token, info: data }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ error: jaga.alasan }, { status: jaga.status });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id tidak sah.' }, { status: 400 });
  const { data, error } = await getAdminClient().from('token_integrasi')
    .update({ dicabut: new Date().toISOString() })
    .eq('id', id).eq('user_id', jaga.user.id).is('dicabut', null).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Token tidak ditemukan atau sudah dicabut.' }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
