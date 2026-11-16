import type { Json } from '@/types/database';
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMenu } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { alatSah, periksaFile } from '@/lib/tools-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_file';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const RINGKAS = 'id, alat, nama, ringkasan, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at';
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;
async function kelolaSemua(db: Db, userId: string) {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  return hasFullAccess(data as { role?: string; access_level?: string } | null);
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const semua = await kelolaSemua(db, jaga.user.id);
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(TABEL).select(`${RINGKAS}, data`).eq('id', id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Berkas tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, file: { ...data, bolehUbah: semua || data.dibuat_oleh === jaga.user.id } });
  }
  const alat = sp.get('alat');
  if (!alatSah(alat)) return gagal('Alat tidak dikenal.');
  let q = db.from(TABEL).select(RINGKAS).eq('alat', alat).order('updated_at', { ascending: false }).limit(100);
  const cari = (sp.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()]/g, ' ');
  if (cari) q = q.or(`nama.ilike.%${cari}%,dibuat_oleh_nama.ilike.%${cari}%,ringkasan.ilike.%${cari}%`);
  const { data, error } = await q;
  if (error) return gagal(error.message, 500);
  return NextResponse.json({
    ok: true,
    daftar: (data ?? []).map((d: { dibuat_oleh: string | null }) => ({ ...d, bolehUbah: semua || d.dibuat_oleh === jaga.user.id })),
  });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const cek = periksaFile(b);
  if (!cek.ok) return gagal(cek.alasan);
  const isi = { nama: cek.nama, data: cek.data as unknown as Json, ringkasan: cek.ringkasan, diubah_oleh_nama: jaga.user.full_name };
  const id = typeof b.id === 'string' ? b.id : null;
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh, alat').eq('id', id).maybeSingle();
    if (!lama) return gagal('Berkas tidak ditemukan.', 404);
    if (lama.alat !== cek.alat) return gagal('Berkas ini milik alat lain.');
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
      return gagal('Berkas ini milik orang lain - simpan sebagai salinan.', 403);
    }
    const { data, error } = await db.from(TABEL).update({ ...isi, updated_at: new Date().toISOString() }).eq('id', id).select('id, nama, updated_at').single();
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, file: { ...data, bolehUbah: true } });
  }
  const { data, error } = await db.from(TABEL).insert({ ...isi, alat: cek.alat, dibuat_oleh: jaga.user.id, dibuat_oleh_nama: jaga.user.full_name })
    .select('id, nama, updated_at').single();
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, file: { ...data, bolehUbah: true } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!lama) return gagal('Berkas tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
    return gagal('Hanya pembuat atau Admin yang boleh menghapus.', 403);
  }
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
