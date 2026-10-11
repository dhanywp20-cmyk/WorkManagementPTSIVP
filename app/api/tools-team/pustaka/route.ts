/**
 * /api/tools-team/pustaka - Pustaka Tools Team (produk, data acuan, artikel). Lihat lib/pustaka.ts.
 *
 *   GET ?jenis=a,b      Admin, Team, pimpinan, atau akun berizin 'tools-pustaka': entri jenis-jenis itu + `bolehAtur`.
 *                       Tanpa ?jenis = semua jenis kecuali isi artikel (ringkasan saja).
 *                       Tiap entri membawa `bolehUbah` (boleh ubah / hapus entri itu).
 *   POST {id?, jenis, nama, data}
 *                       Admin / Full Access: tambah (tanpa id) atau ubah entri. Data divalidasi
 *                       registri (periksaEntri) - bidang tak dikenal dibuang.
 *   DELETE ?id=         Admin / Full Access.
 *
 * Ubah & hapus satu entri: Admin (admin / superadmin) semua entri; Team Full Access hanya entri
 * buatannya sendiri (bolehUbahEntri) - ditegakkan di sini, bukan cuma tombol yang disembunyikan.
 *
 * Tabel ber-RLS tanpa policy (migrasi 040): hanya service role di sini. Hak dibaca ulang dari tabel
 * users; akun pimpinan hanya-lihat tidak boleh menulis.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb } from '@/lib/pimpinan';
import { bolehLihatPustaka, bolehUbahEntri, KODE_JENIS, periksaEntri } from '@/lib/pustaka';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_pustaka';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const MAKS_ENTRI = 2000;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });
type Db = ReturnType<typeof getAdminClient>;

/** atur = boleh menambah (Admin / Full Access, bukan pimpinan); admin = boleh mengubah entri siapa pun. */
async function hakPustaka(db: Db, userId: string): Promise<{ atur: boolean; admin: boolean }> {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  const u = data as { role?: string; access_level?: string } | null;
  if (!hasFullAccess(u) || (await pimpinanDiDb(db, userId))) return { atur: false, admin: false };
  const r = (u?.role ?? '').toLowerCase();
  return { atur: true, admin: r === 'admin' || r === 'superadmin' };
}

/** Penjaga ubah / hapus satu entri: 404 bila tidak ada, 403 bila bukan pembuatnya (dan bukan Admin). */
async function cekPemilik(db: Db, id: string, akun: { id: string; admin: boolean }): Promise<NextResponse | null> {
  const { data } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!data) return gagal('Entri tidak ditemukan.', 404);
  if (!bolehUbahEntri(akun, (data as { dibuat_oleh: string | null }).dibuat_oleh)) {
    return gagal('Entri ini dibuat orang lain - hanya pembuatnya atau Admin yang boleh mengubah / menghapusnya.', 403);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  //  Pustaka: Admin, Team & pimpinan; Marketing / Sales hanya dengan izin 'tools-pustaka' (allowed_menus).
  const { data: u } = await db.from('users').select('role, allowed_menus, pimpinan').eq('id', jaga.user.id).maybeSingle();
  if (!bolehLihatPustaka(u as Parameters<typeof bolehLihatPustaka>[0])) return gagal('Pustaka hanya untuk akun yang diberi izin.', 403);
  const minta = (req.nextUrl.searchParams.get('jenis') ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (minta.some(j => !KODE_JENIS.includes(j))) return gagal('Jenis pustaka tidak dikenal.');
  //  Tanpa ?jenis: isi artikel (bisa panjang) tidak ikut - dibaca saat artikelnya dibuka.
  let q = db.from(TABEL).select(minta.length
    ? 'id, jenis, nama, data, diubah_oleh_nama, updated_at, dibuat_oleh'
    : 'id, jenis, nama, ringkas:data->ringkas, kategori:data->kategori, diubah_oleh_nama, updated_at, dibuat_oleh')
    .order('nama', { ascending: true }).limit(MAKS_ENTRI);
  if (minta.length) q = q.in('jenis', minta);
  const [{ data, error }, hak] = await Promise.all([q, hakPustaka(db, jaga.user.id)]);
  if (error) return gagal(error.message, 500);
  const akun = { id: jaga.user.id, admin: hak.admin };
  //  dibuat_oleh (uuid) tidak dikirim ke peramban - cukup tanda boleh-ubah per entri.
  const entri = ((data ?? []) as unknown as ({ dibuat_oleh: string | null } & Record<string, unknown>)[])
    .map(({ dibuat_oleh, ...e }) => ({ ...e, bolehUbah: hak.atur && bolehUbahEntri(akun, dibuat_oleh) }));
  return NextResponse.json({ ok: true, entri, bolehAtur: hak.atur });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const hak = await hakPustaka(db, jaga.user.id);
  if (!hak.atur) return gagal('Hanya Admin yang boleh mengubah Pustaka.', 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const cek = periksaEntri(b.jenis, b.nama, b.data);
  if (!cek.ok) return gagal(cek.alasan);
  const isi = { jenis: cek.jenis, nama: cek.nama, data: cek.data, diubah_oleh_nama: jaga.user.full_name ?? jaga.user.username ?? null, updated_at: new Date().toISOString() };

  if (typeof b.id === 'string' && b.id) {
    if (!POLA_ID.test(b.id)) return gagal('ID tidak sah.');
    const tolak = await cekPemilik(db, b.id, { id: jaga.user.id, admin: hak.admin });
    if (tolak) return tolak;
    const { data, error } = await db.from(TABEL).update(isi).eq('id', b.id).select('id, jenis, nama, data, diubah_oleh_nama, updated_at').maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Entri tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, entri: { ...data, bolehUbah: true } });
  }
  const { count } = await db.from(TABEL).select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAKS_ENTRI) return gagal(`Pustaka penuh (maks ${MAKS_ENTRI} entri) - hapus entri yang tidak dipakai.`);
  const { data, error } = await db.from(TABEL).insert({ ...isi, dibuat_oleh: jaga.user.id }).select('id, jenis, nama, data, diubah_oleh_nama, updated_at').single();
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, entri: { ...data, bolehUbah: true } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const hak = await hakPustaka(db, jaga.user.id);
  if (!hak.atur) return gagal('Hanya Admin yang boleh mengubah Pustaka.', 403);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const tolak = await cekPemilik(db, id, { id: jaga.user.id, admin: hak.admin });
  if (tolak) return tolak;
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
