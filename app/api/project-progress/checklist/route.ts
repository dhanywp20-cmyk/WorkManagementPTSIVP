import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, akunAdmin, ambilAkun, galat } from '@/lib/checklist-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/project-progress/checklist - admin: semua checklist (judul,
 * proyek, jumlah item) sebagai sumber "Salin dari" saat membuat checklist
 * lokasi baru. Isi checklist tidak ikut - hanya yang perlu untuk memilih.
 */
export async function GET(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun)) return galat('Khusus admin.', 403);

  const [{ data: daftar, error }, { data: proyek }] = await Promise.all([
    s.db.from('checklist_daftar').select('id,judul,proyek_id,updated_at').order('updated_at', { ascending: false }).limit(1000),
    s.db.from('checklist_proyek').select('id,nama').limit(1000),
  ]);
  if (error) return galat(error.message, 500);

  const jumlah = new Map<string, number>();
  for (let dari = 0; ; dari += 1000) {
    const { data, error: iErr } = await s.db.from('checklist_item').select('daftar_id').order('id').range(dari, dari + 999);
    if (iErr) return galat(iErr.message, 500);
    for (const r of (data ?? []) as { daftar_id: string }[]) jumlah.set(r.daftar_id, (jumlah.get(r.daftar_id) ?? 0) + 1);
    if (!data || data.length < 1000) break;
  }
  const namaProyek = new Map(((proyek ?? []) as { id: string; nama: string }[]).map(p => [p.id, p.nama]));

  return NextResponse.json({
    checklist: ((daftar ?? []) as { id: string; judul: string; proyek_id: string }[])
      .map(d => ({ id: d.id, judul: d.judul, proyek: namaProyek.get(d.proyek_id) ?? '', jumlah: jumlah.get(d.id) ?? 0 }))
      .filter(d => d.jumlah > 0),
  }, { headers: NO_STORE });
}
