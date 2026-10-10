/**
 * /api/tools-team/objek-saya - "Objek saya" Desain 3D: objek PRIBADI per akun (lib/objek-saya.ts).
 *
 *   GET                  daftar objek milik akun ini (tanpa isi model) + kuota.
 *   GET ?id=&model=1     isi model 3D (GLB data URL) satu objek milik akun ini - diambil saat dipasang.
 *   POST { objek: [...] } simpan satu objek atau impor beberapa sekaligus (berkas ekspor akun lain).
 *   DELETE ?id=          hapus objek milik akun ini.
 *
 * Setiap kueri dibatasi user_id = akun yang masuk: objek orang lain tidak bisa dibaca, diubah, atau
 * dihapus. Berbagi ke akun lain hanya lewat ekspor / impor berkas. Tabel ber-RLS tanpa policy (migrasi
 * 043) - hanya service role di sini. Akun pimpinan hanya-lihat tidak boleh menulis.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { MAKS_IMPOR_SEKALI, MAKS_MODEL_PER_AKUN, MAKS_OBJEK_PER_AKUN, MAKS_TOTAL_MODEL, periksaObjekSaya, type IsiObjekSaya } from '@/lib/objek-saya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_objek_saya';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const KOLOM_DAFTAR = 'id, nama, ket, jenis, atur, ukuran_model, updated_at';
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });
type Db = ReturnType<typeof getAdminClient>;

async function kuota(db: Db, userId: string) {
  const [semua, model] = await Promise.all([
    db.from(TABEL).select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from(TABEL).select('id', { count: 'exact', head: true }).eq('user_id', userId).not('model', 'is', null),
  ]);
  return { objek: semua.count ?? 0, model: model.count ?? 0, maksObjek: MAKS_OBJEK_PER_AKUN, maksModel: MAKS_MODEL_PER_AKUN };
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');
  if (id !== null) {
    if (!POLA_ID.test(id) || sp.get('model') !== '1') return gagal('Permintaan tidak sah.');
    const { data, error } = await db.from(TABEL).select('model').eq('id', id).eq('user_id', jaga.user.id).maybeSingle();
    if (error) return gagal(error.message, 500);
    const model = (data as { model: string | null } | null)?.model;
    if (!model) return gagal('Model tidak ditemukan.', 404);
    //  Isi model satu id tidak pernah berubah (tidak ada endpoint ubah) - cache permanen, cukup diunduh sekali.
    return NextResponse.json({ ok: true, model }, { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
  const [{ data, error }, k] = await Promise.all([
    db.from(TABEL).select(KOLOM_DAFTAR).eq('user_id', jaga.user.id).order('created_at', { ascending: false }).limit(MAKS_OBJEK_PER_AKUN),
    kuota(db, jaga.user.id),
  ]);
  if (error) return gagal(error.message, 500);
  const daftar = ((data ?? []) as { ukuran_model: number }[]).map(({ ukuran_model, ...o }) => ({ ...o, adaModel: ukuran_model > 0, ukuranModel: ukuran_model }));
  return NextResponse.json({ ok: true, daftar, kuota: k });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const masuk = Array.isArray(b.objek) ? b.objek : [];
  if (!masuk.length) return gagal('Tidak ada objek untuk disimpan.');
  if (masuk.length > MAKS_IMPOR_SEKALI) return gagal(`Maksimal ${MAKS_IMPOR_SEKALI} objek sekali simpan.`);
  const sah: IsiObjekSaya[] = [], ditolak: string[] = [];
  for (const o of masuk) { const c = periksaObjekSaya(o); if (c.ok) sah.push(c.data); else ditolak.push(c.alasan); }
  if (!sah.length) return gagal(ditolak[0] ?? 'Objek tidak sah.');
  const k = await kuota(db, jaga.user.id);
  if (k.objek + sah.length > MAKS_OBJEK_PER_AKUN) return gagal(`Objek saya penuh (maks ${MAKS_OBJEK_PER_AKUN}) - hapus yang tidak dipakai dulu.`);
  const jumlahModel = sah.filter(o => o.model).length;
  if (k.model + jumlahModel > MAKS_MODEL_PER_AKUN) return gagal(`Model 3D di Objek saya maksimal ${MAKS_MODEL_PER_AKUN} - hapus model yang tidak dipakai dulu.`);
  if (jumlahModel) {
    //  Pengaman kuota paket gratis: total model seluruh akun dibatasi.
    const { data: semuaModel } = await db.from(TABEL).select('ukuran_model').gt('ukuran_model', 0);
    const terpakai = ((semuaModel ?? []) as { ukuran_model: number }[]).reduce((s, r) => s + r.ukuran_model, 0);
    const tambahan = sah.reduce((s, o) => s + (o.model?.length ?? 0), 0);
    if (terpakai + tambahan > MAKS_TOTAL_MODEL) return gagal('Ruang model 3D Objek saya untuk seluruh tim sudah penuh - simpan model lewat Simpan .glb laptop.');
  }
  const sekarang = new Date().toISOString();
  const { data, error } = await db.from(TABEL).insert(sah.map(o => ({
    user_id: jaga.user.id, nama: o.nama, ket: o.ket, jenis: o.jenis, atur: o.atur,
    model: o.model ?? null, ukuran_model: o.model?.length ?? 0, updated_at: sekarang,
  }))).select(KOLOM_DAFTAR);
  if (error) return gagal(error.message, 500);
  const baru = ((data ?? []) as { ukuran_model: number }[]).map(({ ukuran_model, ...o }) => ({ ...o, adaModel: ukuran_model > 0, ukuranModel: ukuran_model }));
  return NextResponse.json({ ok: true, baru, ditolak });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const { data, error } = await db.from(TABEL).delete().eq('id', id).eq('user_id', jaga.user.id).select('id');
  if (error) return gagal(error.message, 500);
  if (!data?.length) return gagal('Objek tidak ditemukan.', 404);
  return NextResponse.json({ ok: true });
}
