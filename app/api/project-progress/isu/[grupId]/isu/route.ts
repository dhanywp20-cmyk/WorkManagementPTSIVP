import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat } from '@/lib/checklist/server';
import { KOLOM_ISU, catatRiwayat, hakIsu, isianIsu, muatGrup, muatLokasi, nomorBerikut, sentuhGrup, type IsianIsu } from '@/lib/isu/server';
import type { Isu } from '@/lib/isu/inti';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ grupId: string }> }) {
  const { grupId } = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).edit) return galat('Anda tidak punya akses mencatat isu.', 403);
  const grup = await muatGrup(s.db, grupId);
  if (!grup) return galat('Grup tidak ditemukan.', 404);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const lokasi = await muatLokasi(s.db, grup.proyek_ids);
  const hasil = isianIsu(body, lokasi, false);
  if ('galat' in hasil) return galat(hasil.galat);
  const isian = hasil.isian as IsianIsu;
  if (isian.status === 'solved' && !isian.solusi) return galat('Isi solusi bila isu langsung ditandai Solved.');
  const selesai_pada = isian.status === 'solved' ? new Date().toISOString() : null;

  for (let coba = 0; coba < 4; coba++) {
    const nomor = await nomorBerikut(s.db, grupId);
    const { data, error } = await s.db.from('isu_log').insert({
      ...isian, grup_id: grupId, nomor, selesai_pada,
      dibuat_oleh_nama: s.akun.nama, diubah_oleh_nama: s.akun.nama,
    }).select(KOLOM_ISU).single();
    if (error?.code === '23505') continue;
    if (error) return galat(error.message, 500);
    const isu = data as unknown as Isu;
    await catatRiwayat(s.db, [{
      isu_id: isu.id, aksi: 'dibuat', ke: isu.status, nama: s.akun.nama,
      keterangan: isu.action ? isu.action : '',
    }]);
    await sentuhGrup(s.db, grupId);
    return NextResponse.json({ isu }, { headers: NO_STORE });
  }
  return galat('Gagal memberi nomor isu, coba simpan lagi.', 409);
}
