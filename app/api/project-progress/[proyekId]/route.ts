import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, akunAdmin, ambilAkun, galat, muatProyek, tokenBaru } from '@/lib/checklist-server';
import { isianProyek, statusProyek } from '@/lib/checklist-isian';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/project-progress/<proyekId>
 *   GET    -> info proyek + checklist per lokasi yang boleh dilihat
 *   PATCH  -> admin: { aksi: 'ubahInfo' | 'status' | 'share' | 'tokenBaru', ... }
 *   DELETE -> admin: hapus proyek beserta semua checklist & riwayatnya
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ proyekId: string }> }) {
  const params = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  try {
    const hasil = await muatProyek(s.db, s.akun, params.proyekId);
    if (hasil === 'tidak-ada') return galat('Proyek tidak ditemukan.', 404);
    if (hasil === 'terlarang') return galat('Anda tidak punya akses ke proyek ini.', 403);
    return NextResponse.json(hasil, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat proyek.', 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ proyekId: string }> }) {
  const params = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun)) return galat('Hanya admin yang bisa mengubah proyek.', 403);
  const { db } = s;
  const id = params.proyekId;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const { data: ada } = await db.from('checklist_proyek').select('id,share_token').eq('id', id).maybeSingle();
  if (!ada) return galat('Proyek tidak ditemukan.', 404);
  const sekarang = new Date().toISOString();

  switch (body.aksi) {
    case 'ubahInfo': {
      const hasil = isianProyek(body);
      if ('galat' in hasil) return galat(hasil.galat);
      let sales_division: string | null = null;
      if (hasil.isian.sales_name) {
        const { data: u } = await db.from('users').select('sales_division')
          .eq('full_name', hasil.isian.sales_name).limit(1).maybeSingle();
        sales_division = u?.sales_division ?? null;
      }
      const { error } = await db.from('checklist_proyek')
        .update({ ...hasil.isian, sales_division, updated_at: sekarang }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    case 'status': {
      const { error } = await db.from('checklist_proyek')
        .update({ status: statusProyek(body.status), updated_at: sekarang }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    case 'share': {
      // Token dipakai ulang saat link dinyalakan lagi - link yang sudah
      // tersebar tetap berlaku. Memutus link lama = aksi 'tokenBaru'.
      const share_token = ada.share_token ?? tokenBaru();
      const share_aktif = body.aktif === true;
      const { error } = await db.from('checklist_proyek').update({ share_aktif, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ share_aktif, share_token }, { headers: NO_STORE });
    }
    case 'tokenBaru': {
      const share_token = tokenBaru();
      const { error } = await db.from('checklist_proyek').update({ share_aktif: true, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ share_aktif: true, share_token }, { headers: NO_STORE });
    }
    default:
      return galat('Aksi tidak dikenal.');
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ proyekId: string }> }) {
  const params = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun)) return galat('Hanya admin yang bisa menghapus proyek.', 403);
  const { error } = await s.db.from('checklist_proyek').delete().eq('id', params.proyekId);
  if (error) return galat(error.message, 500);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
