import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, cariChecklistShare, galat, muatChecklist } from '@/lib/checklist/server';
import { simpanPerubahan } from '@/lib/checklist/server-simpan';
import { validasiNama } from '@/lib/checklist/inti';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JEDA_SIMPAN_MS = 3_000;
const TIDAK_ADA = 'Link tidak ditemukan atau sudah dinonaktifkan.';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  try {
    const detail = await muatChecklist(ketemu.db, ketemu.id, { publik: true });
    if (!detail) return galat(TIDAK_ADA, 404);
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat checklist.', 500);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  const { db, id } = ketemu;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const nama = validasiNama(body.nama);
  if (!nama) return galat('Isi nama Anda (2-60 karakter) sebelum mengubah checklist.');

  const { data: d } = await db.from('checklist_daftar').select('updated_at').eq('id', id).single();
  const terakhir = d?.updated_at ? Date.parse(d.updated_at) : 0;
  if (Date.now() - terakhir < JEDA_SIMPAN_MS) return galat('Terlalu cepat. Tunggu beberapa detik lalu simpan lagi.', 429);

  if (body.aksi !== 'simpan') return galat('Aksi tidak dikenal. Muat ulang halaman.');
  const hasil = await simpanPerubahan(db, id, body.perubahan, nama, 'link');
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
