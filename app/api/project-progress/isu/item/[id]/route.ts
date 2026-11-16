import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat, type Db } from '@/lib/checklist/server';
import { KOLOM_ISU, KOLOM_RIWAYAT, catatRiwayat, hakIsu, isianIsu, kolomBerubah, muatGrup, muatLokasi, sentuhGrup } from '@/lib/isu/server';
import type { Isu } from '@/lib/isu/inti';
import type { TablesUpdate } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ambilIsu(db: Db, id: string): Promise<Isu | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from('isu_log').select(KOLOM_ISU).eq('id', id).maybeSingle();
  return (data as unknown as Isu | null) ?? null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).lihat) return galat('Issue Log hanya untuk tim internal.', 403);
  const isu = await ambilIsu(s.db, id);
  if (!isu) return galat('Isu tidak ditemukan.', 404);
  const { data, error } = await s.db.from('isu_riwayat').select(KOLOM_RIWAYAT).eq('isu_id', id).order('created_at');
  if (error) return galat(error.message, 500);
  return NextResponse.json({ riwayat: data ?? [] }, { headers: NO_STORE });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).edit) return galat('Anda tidak punya akses mengubah isu.', 403);
  const lama = await ambilIsu(s.db, id);
  if (!lama) return galat('Isu tidak ditemukan.', 404);
  const grup = await muatGrup(s.db, lama.grup_id);
  if (!grup) return galat('Grup tidak ditemukan.', 404);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const perluLokasi = 'daftar_id' in body || 'lokasi' in body;
  const lokasi = perluLokasi ? await muatLokasi(s.db, grup.proyek_ids) : [];
  const hasil = isianIsu(body, lokasi, true);
  if ('galat' in hasil) return galat(hasil.galat);
  const isian = hasil.isian;

  const statusBaru = isian.status && isian.status !== lama.status ? isian.status : null;
  if (statusBaru === 'solved' && !(isian.solusi ?? lama.solusi)) return galat('Isi solusi sebelum menandai Solved.');
  const ubah: TablesUpdate<'isu_log'> = { ...isian, diubah_oleh_nama: s.akun.nama };
  if (statusBaru === 'solved') ubah.selesai_pada = new Date().toISOString();
  else if (statusBaru) ubah.selesai_pada = null;

  const { data, error } = await s.db.from('isu_log').update(ubah).eq('id', id).select(KOLOM_ISU).single();
  if (error) return galat(error.message, 500);

  const actionBaru = typeof isian.action === 'string' && isian.action && isian.action !== lama.action ? isian.action : null;
  const riwayat: Parameters<typeof catatRiwayat>[1] = [];
  if (statusBaru) {
    const ket = statusBaru === 'solved' ? (isian.solusi ?? lama.solusi) : actionBaru ?? '';
    riwayat.push({ isu_id: id, aksi: 'status', dari: lama.status, ke: statusBaru, nama: s.akun.nama, keterangan: ket });
  } else if (actionBaru) {
    riwayat.push({ isu_id: id, aksi: 'action', nama: s.akun.nama, keterangan: actionBaru });
  }
  const lain = kolomBerubah(lama, isian).filter(k => !(statusBaru === 'solved' && k === 'solusi'));
  if (lain.length) riwayat.push({ isu_id: id, aksi: 'ubah', nama: s.akun.nama, keterangan: `Mengubah ${lain.join(', ')}` });
  await catatRiwayat(s.db, riwayat);
  await sentuhGrup(s.db, lama.grup_id);
  return NextResponse.json({ isu: data }, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).admin) return galat('Hanya admin yang bisa menghapus isu.', 403);
  const lama = await ambilIsu(s.db, id);
  if (!lama) return galat('Isu tidak ditemukan.', 404);
  const { error } = await s.db.from('isu_log').delete().eq('id', id);
  if (error) return galat(error.message, 500);
  await sentuhGrup(s.db, lama.grup_id);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
