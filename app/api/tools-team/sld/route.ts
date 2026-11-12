import type { Json } from '@/types/database';
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMenu } from '@/lib/auth/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { bersihkanDok, tanpaFoto } from '@/lib/sld/dok';
import { semuaPerangkat } from '@/lib/sld/ruang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_sld';
const VERSI = 'tools_sld_versi';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const MAKS_BYTE = 400_000;
const SIMPAN_VERSI = 20;
const PER_HALAMAN = 20;
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

  if (id && sp.get('riwayat') === '1') {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(VERSI).select('versi, created_at, dibuat_oleh_nama').eq('sld_id', id).order('versi', { ascending: false }).limit(100);
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, versi: data ?? [] });
  }

  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(TABEL)
      .select('id, nama, data, versi, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at, diarsipkan_at').eq('id', id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('SLD tidak ditemukan.', 404);
    const bolehUbah = semua || data.dibuat_oleh === jaga.user.id;
    const versi = Number(sp.get('versi'));
    if (Number.isInteger(versi) && versi >= 1 && versi !== data.versi) {
      const { data: v, error: e2 } = await db.from(VERSI).select('nama, data, versi, created_at, dibuat_oleh_nama').eq('sld_id', id).eq('versi', versi).maybeSingle();
      if (e2) return gagal(e2.message, 500);
      if (!v) return gagal(`Versi ${versi} tidak ditemukan.`, 404);
      return NextResponse.json({ ok: true, sld: { ...data, ...v, versiTerbaru: data.versi, updated_at: v.created_at, bolehUbah } });
    }
    return NextResponse.json({ ok: true, sld: { ...data, versiTerbaru: data.versi, bolehUbah } });
  }

  const hal = Math.max(0, Math.min(500, Math.floor(Number(sp.get('hal')) || 0)));
  let q = db.from(TABEL).select('id, nama, versi, jumlah_perangkat, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at', { count: 'exact' })
    .is('diarsipkan_at', null).order('updated_at', { ascending: false }).range(hal * PER_HALAMAN, hal * PER_HALAMAN + PER_HALAMAN - 1);
  const cari = (sp.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()]/g, ' ');
  if (cari) q = q.or(`nama.ilike.%${cari}%,dibuat_oleh_nama.ilike.%${cari}%`);
  const { data, error, count } = await q;
  if (error) return gagal(error.message, 500);
  const daftar = (data ?? []) as { id: string; dibuat_oleh: string | null }[];
  return NextResponse.json({ ok: true, hal, perHalaman: PER_HALAMAN, total: count ?? daftar.length, daftar: daftar.map(d => ({ ...d, bolehUbah: semua || d.dibuat_oleh === jaga.user.id })) });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }

  const nama = String(b.nama ?? '').trim().slice(0, 120);
  if (!nama) return gagal('Nama SLD wajib diisi.');
  const dok = bersihkanDok(b.data);
  if (!dok) return gagal('Isi SLD tidak sah.');
  const data = tanpaFoto(dok);
  if (JSON.stringify(data).length > MAKS_BYTE) return gagal('SLD terlalu besar untuk disimpan.');

  const id = typeof b.id === 'string' ? b.id : null;
  let versiLama: number | null = null;
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh, versi').eq('id', id).maybeSingle();
    if (!lama) return gagal('SLD tidak ditemukan.', 404);
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) return gagal('SLD ini milik orang lain - gunakan Simpan sebagai.', 403);
    const dikirim = Number(b.versi);
    versiLama = Number.isInteger(dikirim) && dikirim >= 1 ? dikirim : lama.versi;
    if (versiLama !== lama.versi) {
      return gagal(`SLD ini sudah diubah sejak Anda buka (sekarang v${lama.versi}). Gunakan Simpan sebagai, atau buka ulang versi terbaru.`, 409);
    }
  }

  const { data: hasilRpc, error } = await db.rpc('tools_simpan_sld', {
    p_id: id as string, p_versi: versiLama as number, p_nama: nama, p_data: data as unknown as Json, p_jumlah: semuaPerangkat(data).length, p_user: jaga.user.id, p_user_nama: jaga.user.full_name,
  });
  if (error) {
    if (/konflik/.test(error.message)) return gagal('SLD ini baru saja diubah orang lain. Buka ulang versi terbaru.', 409);
    return gagal(error.message, 500);
  }
  const hasil = (Array.isArray(hasilRpc) ? hasilRpc[0] : hasilRpc) as { id: string; versi: number; updated_at: string } | null;
  if (!hasil) return gagal('Gagal menyimpan.', 500);
  if (hasil.versi > SIMPAN_VERSI) {
    try {
      const { data: t } = await db.from('request_sld').select('versi').eq('sld_id', hasil.id);
      const dipakai = [...new Set(((t ?? []) as { versi: number }[]).map(x => x.versi))];
      let hapus = db.from(VERSI).delete().eq('sld_id', hasil.id).lte('versi', hasil.versi - SIMPAN_VERSI);
      if (dipakai.length) hapus = hapus.not('versi', 'in', `(${dipakai.join(',')})`);
      await hapus;
    } catch {  }
  }
  return NextResponse.json({ ok: true, sld: { id: hasil.id, nama, versi: hasil.versi, updated_at: hasil.updated_at, bolehUbah: true } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMenu(req, 'tools-team');
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!lama) return gagal('SLD tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) return gagal('Hanya pembuat SLD atau Admin yang boleh menghapus.', 403);
  const { count } = await db.from('request_sld').select('id', { count: 'exact', head: true }).eq('sld_id', id);
  if (count) {
    const { error } = await db.from(TABEL).update({ diarsipkan_at: new Date().toISOString() }).eq('id', id);
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, diarsipkan: true, tautan: count });
  }
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
