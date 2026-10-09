/**
 * /api/tools-team/template-kategori - template default per kategori Desain 3D (Tools Team).
 *
 *   GET                 siapa pun yang masuk: daftar kategori yang punya template Admin (tanpa isi),
 *                       untuk penanda di panel Kategori. + `bolehAtur` untuk akun ini.
 *   GET ?kategori=      isi lengkap template kategori itu (null = pakai bawaan kode).
 *   POST {kategori, nama, data}
 *                       Admin / Full Access: jadikan isi kanvas template default kategori.
 *   DELETE ?kategori=   Admin / Full Access: kembali ke template bawaan kode.
 *
 * Tabel ber-RLS tanpa policy (migrasi 039): hanya service role di sini yang menyentuhnya.
 * Hak Admin dibaca ulang dari tabel users (bukan klaim token); akun pimpinan hanya-lihat ditolak.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { periksaDesain, kategoriRuangSah } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_template_kategori';
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });
type Db = ReturnType<typeof getAdminClient>;

/** Admin / Full Access, bukan akun pimpinan hanya-lihat. */
async function bolehAtur(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  if (!hasFullAccess(data as { role?: string; access_level?: string } | null)) return false;
  return !(await pimpinanDiDb(db, userId));
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const kategori = req.nextUrl.searchParams.get('kategori');

  if (kategori !== null) {
    if (!kategoriRuangSah(kategori)) return gagal('Kategori tidak dikenal.');
    const { data, error } = await db.from(TABEL)
      .select('kategori, nama, data, ditetapkan_oleh_nama, updated_at').eq('kategori', kategori).maybeSingle();
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, template: data ?? null });
  }

  const [{ data, error }, atur] = await Promise.all([
    db.from(TABEL).select('kategori, nama, ditetapkan_oleh_nama, updated_at'),
    bolehAtur(db, jaga.user.id),
  ]);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, daftar: data ?? [], bolehAtur: atur });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  if (!(await bolehAtur(db, jaga.user.id))) return gagal('Hanya Admin yang boleh mengatur template default kategori.', 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  if (!kategoriRuangSah(b.kategori)) return gagal('Kategori tidak dikenal.');
  const nama = String(b.nama ?? '').trim().slice(0, 120);
  if (!nama) return gagal('Nama template wajib diisi.');
  const cek = periksaDesain(b.data);
  if (!cek.ok) return gagal(cek.alasan);

  const updated_at = new Date().toISOString();
  const { error } = await db.from(TABEL).upsert({
    kategori: b.kategori, nama, data: cek.data,
    ditetapkan_oleh: jaga.user.id, ditetapkan_oleh_nama: jaga.user.full_name ?? jaga.user.username ?? null, updated_at,
  }, { onConflict: 'kategori' });
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, template: { kategori: b.kategori, nama, ditetapkan_oleh_nama: jaga.user.full_name ?? null, updated_at } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (!(await bolehAtur(db, jaga.user.id))) return gagal('Hanya Admin yang boleh mengatur template default kategori.', 403);
  const kategori = req.nextUrl.searchParams.get('kategori');
  if (!kategoriRuangSah(kategori)) return gagal('Kategori tidak dikenal.');
  const { error } = await db.from(TABEL).delete().eq('kategori', kategori);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
