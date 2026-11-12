import { NextRequest, NextResponse } from 'next/server';
import { pastikanMenu } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { bersihkanItemTim, MAKS_FOTO_TIM, POLA_DATA_FOTO_TIM } from '@/lib/sld/katalog-tim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_sld_katalog';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const MAKS_ITEM = 300;
const KOLOM = 'id, nama, kategori, kelompok, ikon, model, port, ket, lebar, rasio, versi, ada_foto, dibuat_oleh, dibuat_oleh_nama, updated_at';
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;
type Baris = { id: string; nama: string; kategori: string; kelompok: string; ikon: string; model: string; port: string[]; ket: string; lebar: number; rasio: number | null;
  versi: number; ada_foto: boolean; dibuat_oleh: string | null; dibuat_oleh_nama: string };

async function kelolaSemua(db: Db, userId: string) {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  return hasFullAccess(data as { role?: string; access_level?: string } | null);
}

const keItem = (b: Baris, bolehUbah: boolean) => ({
  id: b.id, nama: b.nama, kategori: b.kategori, kelompok: b.kelompok, ikon: b.ikon, model: b.model, port: b.port ?? [], ket: b.ket, lebar: Number(b.lebar),
  rasio: b.rasio === null ? null : Number(b.rasio), versi: b.versi, adaFoto: b.ada_foto, oleh: b.dibuat_oleh_nama, bolehUbah,
});

function bacaFoto(v: unknown): { foto: string | null } | { galat: string } | null {
  if (v === undefined) return null;
  if (v === null) return { foto: null };
  const m = typeof v === 'string' ? POLA_DATA_FOTO_TIM.exec(v) : null;
  if (!m) return { galat: 'Foto harus JPEG.' };
  if (m[1].length > MAKS_FOTO_TIM) return { galat: 'Foto terlalu besar - kecilkan dulu.' };
  const awal = Buffer.from(m[1].slice(0, 8), 'base64');
  if (awal[0] !== 0xff || awal[1] !== 0xd8 || awal[2] !== 0xff) return { galat: 'Isi foto bukan JPEG.' };
  return { foto: m[1] };
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const semua = await kelolaSemua(db, jaga.user.id);
  const { data, error } = await db.from(TABEL).select(KOLOM).is('dihapus_at', null).order('kelompok').order('nama').limit(MAKS_ITEM);
  if (error) return gagal(error.message, 500);
  const daftar = ((data ?? []) as Baris[]).map(b => keItem(b, semua || b.dibuat_oleh === jaga.user.id));
  return NextResponse.json({ ok: true, daftar }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }

  const isi = bersihkanItemTim(b);
  if (!isi) return gagal('Nama object wajib diisi.');
  const foto = bacaFoto(b.foto);
  if (foto && 'galat' in foto) return gagal(foto.galat);
  const rasio = Number(b.rasio);
  const rasioSah = Number.isFinite(rasio) && rasio >= 0.1 && rasio <= 10 ? Math.round(rasio * 1000) / 1000 : null;
  const ubahFoto = foto ? { foto: foto.foto, rasio: foto.foto ? rasioSah : null } : {};
  if (foto?.foto && !rasioSah) return gagal('Rasio foto tidak sah.');

  const id = typeof b.id === 'string' ? b.id : null;
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh, versi, dihapus_at').eq('id', id).maybeSingle();
    if (!lama || lama.dihapus_at) return gagal('Object tidak ditemukan.', 404);
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) return gagal('Hanya pembuat object atau Admin yang boleh mengubah.', 403);
    const { data, error } = await db.from(TABEL)
      .update({ ...isi, ...ubahFoto, versi: lama.versi + 1, diubah_oleh_nama: jaga.user.full_name ?? '', updated_at: new Date().toISOString() })
      .eq('id', id).eq('versi', lama.versi).select(KOLOM).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Object baru saja diubah orang lain. Muat ulang katalog.', 409);
    return NextResponse.json({ ok: true, item: keItem(data as Baris, true) });
  }

  const { count } = await db.from(TABEL).select('id', { count: 'exact', head: true }).is('dihapus_at', null);
  if ((count ?? 0) >= MAKS_ITEM) return gagal(`Katalog tim sudah berisi ${MAKS_ITEM} object. Hapus yang tidak dipakai dulu.`);
  const { data, error } = await db.from(TABEL)
    .insert({ ...isi, ...ubahFoto, dibuat_oleh: jaga.user.id, dibuat_oleh_nama: jaga.user.full_name ?? '', diubah_oleh_nama: jaga.user.full_name ?? '' })
    .select(KOLOM).single();
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, item: keItem(data as Baris, true) });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).is('dihapus_at', null).maybeSingle();
  if (!lama) return gagal('Object tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) return gagal('Hanya pembuat object atau Admin yang boleh menghapus.', 403);
  const { error } = await db.from(TABEL).update({ dihapus_at: new Date().toISOString() }).eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
