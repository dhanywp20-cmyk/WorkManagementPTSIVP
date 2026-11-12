import type { Json } from '@/types/database';
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMenu } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { KUNCI_PRODUK, MAKS_PRODUK, bacaDaftarProduk, periksaProduk, type ProdukTim } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;
async function hak(db: Db, userId: string) {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  const { data: pim } = await db.from('users').select('pimpinan').eq('id', userId).maybeSingle();
  return { semua: hasFullAccess(data as { role?: string; access_level?: string } | null), pimpinan: pim?.pimpinan === true };
}

async function baca(db: Db): Promise<ProdukTim[]> {
  const { data, error } = await db.from('app_settings').select('value').eq('key', KUNCI_PRODUK).maybeSingle();
  if (error) throw new Error(error.message);
  return bacaDaftarProduk(data?.value);
}

async function tulis(db: Db, daftar: ProdukTim[]) {
  const { error } = await db.from('app_settings').upsert({ key: KUNCI_PRODUK, value: { daftar } as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  try {
    const [daftar, h] = await Promise.all([baca(db), hak(db, jaga.user.id)]);
    return NextResponse.json({
      ok: true, bolehTambah: !h.pimpinan,
      daftar: daftar.map(p => ({ ...p, bolehHapus: !h.pimpinan && (h.semua || p.olehId === jaga.user.id) })),
    });
  } catch (e) { return gagal((e as Error).message, 500); }
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  let body: unknown;
  try { body = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const p = periksaProduk(body);
  if (!p.ok) return gagal(p.alasan);
  try {
    const h = await hak(db, jaga.user.id);
    if (h.pimpinan) return gagal('Akun pimpinan hanya bisa melihat.', 403);
    const daftar = await baca(db);
    if (daftar.length >= MAKS_PRODUK) return gagal(`Katalog penuh (maks ${MAKS_PRODUK} produk). Hapus produk yang tidak terpakai dulu.`);
    const baru: ProdukTim = { ...p.data, id: crypto.randomUUID(), oleh: jaga.user.full_name ?? '', olehId: jaga.user.id, dibuat: new Date().toISOString() };
    await tulis(db, [baru, ...daftar]);
    return NextResponse.json({ ok: true, produk: { ...baru, bolehHapus: true } });
  } catch (e) { return gagal((e as Error).message, 500); }
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  try {
    const [daftar, h] = await Promise.all([baca(db), hak(db, jaga.user.id)]);
    const p = daftar.find(x => x.id === id);
    if (!p) return gagal('Produk tidak ditemukan.', 404);
    if (h.pimpinan || !(h.semua || p.olehId === jaga.user.id)) return gagal('Hanya pembuat produk atau Admin / Full Access yang boleh menghapus.', 403);
    await tulis(db, daftar.filter(x => x.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) { return gagal((e as Error).message, 500); }
}
