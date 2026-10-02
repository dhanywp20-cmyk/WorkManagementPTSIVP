import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, galat, muatDetail, penjagaAdmin, simpanDraft } from '@/lib/checklist-server';
import { BATAS, validasiDraft, type DraftChecklist } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/checklist - khusus admin.
 *   GET  -> semua checklist + jumlah item selesai/total
 *   POST -> { mode:'impor', sumber:'teks'|'excel', draft }   checklist baru dari impor
 *           { mode:'duplikat', sumberId, judul }             salinan bersih (centang dikosongkan)
 */
export async function GET(request: NextRequest) {
  const jaga = await penjagaAdmin(request);
  if ('galat' in jaga) return jaga.galat;
  const { db } = jaga;

  const { data: daftar, error } = await db.from('checklist_daftar')
    .select('id,judul,keterangan,sumber,share_aktif,share_token,dibuat_oleh_nama,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) return galat(error.message, 500);

  // PostgREST membatasi 1000 baris per permintaan - dibaca per halaman supaya
  // hitungan checklist besar tidak terpotong diam-diam.
  const hitung = new Map<string, { total: number; selesai: number }>();
  for (let dari = 0; ; dari += 1000) {
    const { data, error: iErr } = await db.from('checklist_item')
      .select('daftar_id,selesai').order('id').range(dari, dari + 999);
    if (iErr) return galat(iErr.message, 500);
    for (const it of data ?? []) {
      const h = hitung.get(it.daftar_id) ?? { total: 0, selesai: 0 };
      h.total++;
      if (it.selesai) h.selesai++;
      hitung.set(it.daftar_id, h);
    }
    if (!data || data.length < 1000) break;
  }

  return NextResponse.json({
    daftar: (daftar ?? []).map((d: { id: string }) => ({ ...d, ...(hitung.get(d.id) ?? { total: 0, selesai: 0 }) })),
  }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const jaga = await penjagaAdmin(request);
  if ('galat' in jaga) return jaga.galat;
  const { db, admin } = jaga;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  try {
    if (body.mode === 'impor') {
      const sumber = body.sumber === 'excel' ? 'excel' : 'teks';
      const hasil = validasiDraft(body.draft);
      if ('galat' in hasil) return galat(hasil.galat);
      const id = await simpanDraft(db, hasil.draft, sumber, admin);
      return NextResponse.json({ id }, { headers: NO_STORE });
    }

    if (body.mode === 'duplikat') {
      const judul = String(body.judul ?? '').trim().slice(0, BATAS.judul);
      if (!judul) return galat('Judul checklist baru wajib diisi.');
      const asal = await muatDetail(db, String(body.sumberId ?? ''), true);
      if (!asal) return galat('Checklist sumber tidak ditemukan.', 404);

      const draft: DraftChecklist = {
        judul,
        keterangan: asal.daftar.keterangan,
        bagian: asal.bagian.map(b => ({
          judul: b.judul,
          catatan: b.catatan,
          items: asal.items.filter(i => i.bagian_id === b.id)
            .map(i => ({ kelompok: i.kelompok, teks: i.teks, catatan: i.catatan, selesai: false })),
        })),
      };
      const hasil = validasiDraft(draft);
      if ('galat' in hasil) return galat(hasil.galat);
      const id = await simpanDraft(db, hasil.draft, 'duplikat', admin);
      return NextResponse.json({ id }, { headers: NO_STORE });
    }

    return galat('Mode tidak dikenal.');
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal menyimpan checklist.', 500);
  }
}
