import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat } from '@/lib/checklist/server';
import { KOLOM_GRUP, hakIsu, isianGrup } from '@/lib/isu/server';
import type { IsuGrup } from '@/lib/isu/inti';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const hak = hakIsu(s.akun);
  if (!hak.lihat) return galat('Issue Log hanya untuk tim internal.', 403);

  const { data, error } = await s.db.from('isu_grup').select(KOLOM_GRUP).order('created_at');
  if (error) return galat(error.message, 500);
  const grup = ((data ?? []) as IsuGrup[]).map(g => (hak.edit ? g : { ...g, share_token: null }));

  let proyek: { id: string; nama: string; client: string | null; status: string }[] = [];
  if (hak.admin) {
    const { data: p } = await s.db.from('checklist_proyek').select('id,nama,client,status').order('created_at', { ascending: false });
    proyek = (p ?? []) as typeof proyek;
  }
  return NextResponse.json({ grup, proyek, hak: { edit: hak.edit, admin: hak.admin } }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!hakIsu(s.akun).admin) return galat('Hanya admin yang bisa membuat grup Issue Log.', 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const hasil = isianGrup(body);
  if ('galat' in hasil) return galat(hasil.galat);

  const { data, error } = await s.db.from('isu_grup')
    .insert({ ...hasil.isian, dibuat_oleh_nama: s.akun.nama }).select('id').single();
  if (error) return galat(error.message, 500);
  return NextResponse.json({ id: data.id }, { headers: NO_STORE });
}
