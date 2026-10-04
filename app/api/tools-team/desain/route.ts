/**
 * /api/tools-team/desain - desain ruang 3D yang dibagikan ke seluruh tim.
 *
 *   GET            siapa pun yang masuk: daftar desain (tanpa isi benda).
 *   GET ?id=       siapa pun yang masuk: satu desain lengkap.
 *   POST {id?, nama, data}
 *                  simpan. Tanpa id = desain baru (milik pemanggil). Dengan id
 *                  = timpa, hanya pembuat atau Admin/Full Access; pengguna
 *                  lain mendapat 403 dan peramban menyimpannya sebagai salinan.
 *   DELETE ?id=    hapus, hanya pembuat atau Admin/Full Access.
 *
 * Tabel tools_desain_ruang ber-RLS tanpa policy (migrasi 027): hanya service
 * role di sini yang menyentuhnya, sesi diperiksa di server.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { periksaDesain } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_desain_ruang';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;

/** Admin / Full Access dibaca ulang dari tabel users (bukan klaim token). */
async function kelolaSemua(db: Db, userId: string) {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  return hasFullAccess(data as { role?: string; access_level?: string } | null);
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const semua = await kelolaSemua(db, jaga.user.id);
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(TABEL)
      .select('id, nama, data, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at').eq('id', id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Desain tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, desain: { ...data, bolehUbah: semua || data.dibuat_oleh === jaga.user.id } });
  }

  const { data, error } = await db.from(TABEL)
    .select('id, nama, jumlah_benda, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at, ruang:data->ruang')
    .order('updated_at', { ascending: false }).limit(100);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({
    ok: true,
    daftar: (data ?? []).map((d: { dibuat_oleh: string | null }) => ({ ...d, bolehUbah: semua || d.dibuat_oleh === jaga.user.id })),
  });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }

  const nama = String(b.nama ?? '').trim().slice(0, 120);
  if (!nama) return gagal('Nama desain wajib diisi.');
  const cek = periksaDesain(b.data);
  if (!cek.ok) return gagal(cek.alasan);

  const db = getAdminClient();
  const id = typeof b.id === 'string' ? b.id : null;
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
    if (!lama) return gagal('Desain tidak ditemukan.', 404);
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
      return gagal('Desain ini milik orang lain - simpan sebagai salinan.', 403);
    }
    const { data, error } = await db.from(TABEL).update({
      nama, data: cek.data, jumlah_benda: cek.jumlah, diubah_oleh_nama: jaga.user.full_name, updated_at: new Date().toISOString(),
    }).eq('id', id).select('id, nama, updated_at').single();
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, desain: { ...data, bolehUbah: true } });
  }

  const { data, error } = await db.from(TABEL).insert({
    nama, data: cek.data, jumlah_benda: cek.jumlah,
    dibuat_oleh: jaga.user.id, dibuat_oleh_nama: jaga.user.full_name, diubah_oleh_nama: jaga.user.full_name,
  }).select('id, nama, updated_at').single();
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, desain: { ...data, bolehUbah: true } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!lama) return gagal('Desain tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
    return gagal('Hanya pembuat desain atau Admin yang boleh menghapus.', 403);
  }
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
