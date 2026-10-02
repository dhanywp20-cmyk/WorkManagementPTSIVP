import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { KOLOM_ITEM, NO_STORE, galat, tokenSah } from '@/lib/checklist-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/project-progress/share/<token> - PUBLIK, link View-Only satu
 * proyek (semua checklist lokasinya). Dipakai /project-progress/share/<token>.
 *
 * Token Project Progress lama ikut disalin ke checklist_proyek oleh migrasi
 * 025, jadi link yang sudah tersebar sebelum pergantian tetap terbuka.
 *
 * Keamanan: service_role di server, hanya BACA, kolom dipilih eksplisit -
 * share_token proyek maupun checklist tidak pernah ikut keluar.
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const token = (params.token ?? '').trim();
  if (!tokenSah(token)) return galat('Link tidak valid.', 404);
  const db = getAdminClient();

  const { data: proyek, error } = await db.from('checklist_proyek')
    .select('id,nama,client,deskripsi,sales_name,sales_division,status,start_date,target_date,share_aktif,updated_at')
    .eq('share_token', token).maybeSingle();
  if (error || !proyek || !proyek.share_aktif) return galat('Link tidak ditemukan atau sudah dinonaktifkan.', 404);

  const { data: daftar, error: dErr } = await db.from('checklist_daftar')
    .select('id,proyek_id,judul,keterangan,start_date,target_date,urutan,updated_at')
    .eq('proyek_id', proyek.id).order('urutan').order('created_at');
  if (dErr) return galat(dErr.message, 500);
  const ids = (daftar ?? []).map((d: { id: string }) => d.id);

  let bagian: unknown[] = [];
  let items: unknown[] = [];
  if (ids.length) {
    const [bRes, iRes] = await Promise.all([
      db.from('checklist_bagian').select('id,daftar_id,judul,catatan,urutan').in('daftar_id', ids).order('urutan'),
      db.from('checklist_item').select(KOLOM_ITEM).in('daftar_id', ids).order('urutan').limit(5000),
    ]);
    // Kegagalan query JANGAN ditelan jadi array kosong - halaman publik akan
    // tampak "proyek kosong" padahal datanya ada.
    if (bRes.error || iRes.error) return galat(bRes.error?.message ?? iRes.error?.message ?? 'Gagal memuat.', 500);
    bagian = bRes.data ?? [];
    items = iRes.data ?? [];
  }

  return NextResponse.json({ proyek, daftar: daftar ?? [], bagian, items }, { headers: NO_STORE });
}
