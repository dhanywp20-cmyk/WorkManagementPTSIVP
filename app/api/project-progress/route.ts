import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, akunAdmin, ambilAkun, galat, muatDaftarProyek } from '@/lib/checklist-server';
import { isianProyek } from '@/lib/checklist-isian';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/project-progress
 *   GET  -> proyek yang boleh dilihat akun ini + angka ringkas
 *   POST -> buat proyek baru (khusus admin)
 */
export async function GET(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  try {
    const proyek = await muatDaftarProyek(s.db, s.akun);
    return NextResponse.json({ proyek, admin: akunAdmin(s.akun) }, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat proyek.', 500);
  }
}

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun)) return galat('Hanya admin yang bisa membuat proyek.', 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const hasil = isianProyek(body);
  if ('galat' in hasil) return galat(hasil.galat);

  // Divisi selalu mengikuti akun Sales yang dipilih - tidak diketik manual.
  let sales_division: string | null = null;
  if (hasil.isian.sales_name) {
    const { data: u } = await s.db.from('users').select('sales_division')
      .eq('full_name', hasil.isian.sales_name).limit(1).maybeSingle();
    sales_division = u?.sales_division ?? null;
  }

  const { data, error } = await s.db.from('checklist_proyek').insert({
    ...hasil.isian, sales_division, origin: 'manual',
    dibuat_oleh: s.akun.id, dibuat_oleh_nama: s.akun.nama,
  }).select('id').single();
  if (error) return galat(error.message, 500);
  return NextResponse.json({ id: data.id }, { headers: NO_STORE });
}
