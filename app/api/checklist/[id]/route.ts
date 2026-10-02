import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, galat, muatDetail, penjagaAkses, setCentang, tokenBaru } from '@/lib/checklist-server';
import { BATAS } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/checklist/<id> - pemegang menu Checklist Tools (lihat bolehKelolaChecklist).
 *   GET    -> detail (bagian, item, 50 riwayat centang terakhir)
 *   PATCH  -> { aksi, ... } lihat cabang di bawah
 *   DELETE -> hapus checklist beserta bagian, item, dan riwayatnya
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const jaga = await penjagaAkses(request);
  if ('galat' in jaga) return jaga.galat;
  try {
    const detail = await muatDetail(jaga.db, params.id, false);
    if (!detail) return galat('Checklist tidak ditemukan.', 404);
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat checklist.', 500);
  }
}

function teks(v: unknown, batas: number): string {
  return String(v ?? '').replace(/\r/g, '').trim().slice(0, batas);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const jaga = await penjagaAkses(request);
  if ('galat' in jaga) return jaga.galat;
  const { db, pengguna } = jaga;
  const id = params.id;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const { data: ada } = await db.from('checklist_daftar').select('id,share_token').eq('id', id).maybeSingle();
  if (!ada) return galat('Checklist tidak ditemukan.', 404);
  const sekarang = new Date().toISOString();
  const sentuh = () => db.from('checklist_daftar').update({ updated_at: sekarang }).eq('id', id);

  switch (body.aksi) {
    case 'ubahInfo': {
      const judul = teks(body.judul, BATAS.judul);
      if (!judul) return galat('Judul wajib diisi.');
      const { error } = await db.from('checklist_daftar')
        .update({ judul, keterangan: teks(body.keterangan, BATAS.keterangan), updated_at: sekarang }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    case 'share': {
      const aktif = body.aktif === true;
      // Token dibuat sekali lalu dipakai ulang saat link dinyalakan lagi -
      // link yang sudah tersebar tetap berlaku. Ganti token = aksi 'tokenBaru'.
      const share_token = ada.share_token ?? tokenBaru();
      const { error } = await db.from('checklist_daftar')
        .update({ share_aktif: aktif, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ share_aktif: aktif, share_token }, { headers: NO_STORE });
    }

    case 'tokenBaru': {
      const share_token = tokenBaru();
      const { error } = await db.from('checklist_daftar')
        .update({ share_aktif: true, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return NextResponse.json({ share_aktif: true, share_token }, { headers: NO_STORE });
    }

    case 'centang': {
      const hasil = await setCentang(db, id, String(body.itemId ?? ''), body.selesai === true,
        pengguna.full_name || pengguna.username, 'admin');
      if ('galat' in hasil) return galat(hasil.galat, hasil.status);
      return NextResponse.json(hasil, { headers: NO_STORE });
    }

    case 'ubahBagian': {
      const judul = teks(body.judul, BATAS.judul);
      if (!judul) return galat('Judul bagian wajib diisi.');
      const { error } = await db.from('checklist_bagian')
        .update({ judul, catatan: teks(body.catatan, BATAS.catatan) })
        .eq('id', String(body.bagianId ?? '')).eq('daftar_id', id);
      if (error) return galat(error.message, 500);
      await sentuh();
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    case 'tambahItem': {
      const isi = teks(body.teks, BATAS.teks);
      if (!isi) return galat('Teks item wajib diisi.');
      const bagianId = String(body.bagianId ?? '');
      const { data: bagian } = await db.from('checklist_bagian').select('id').eq('id', bagianId).eq('daftar_id', id).maybeSingle();
      if (!bagian) return galat('Bagian tidak ditemukan.', 404);
      const { count } = await db.from('checklist_item').select('id', { count: 'exact', head: true }).eq('daftar_id', id);
      if ((count ?? 0) >= BATAS.item) return galat(`Maksimal ${BATAS.item} item per checklist.`);
      // Urutan dihitung se-checklist; tampilan mengurutkan per bagian, jadi
      // item baru selalu muncul di ujung bagiannya.
      const { data: akhir } = await db.from('checklist_item').select('urutan')
        .eq('daftar_id', id).order('urutan', { ascending: false }).limit(1).maybeSingle();
      const { data: item, error } = await db.from('checklist_item').insert({
        daftar_id: id, bagian_id: bagianId,
        kelompok: teks(body.kelompok, BATAS.judul), teks: isi, catatan: teks(body.catatan, BATAS.catatan),
        urutan: (akhir?.urutan ?? -1) + 1,
      }).select('*').single();
      if (error) return galat(error.message, 500);
      await sentuh();
      return NextResponse.json({ item }, { headers: NO_STORE });
    }

    case 'ubahItem': {
      const isi = teks(body.teks, BATAS.teks);
      if (!isi) return galat('Teks item wajib diisi.');
      const { data: item, error } = await db.from('checklist_item')
        .update({ teks: isi, kelompok: teks(body.kelompok, BATAS.judul), catatan: teks(body.catatan, BATAS.catatan) })
        .eq('id', String(body.itemId ?? '')).eq('daftar_id', id).select('*').maybeSingle();
      if (error) return galat(error.message, 500);
      if (!item) return galat('Item tidak ditemukan.', 404);
      await sentuh();
      return NextResponse.json({ item }, { headers: NO_STORE });
    }

    case 'hapusItem': {
      const { error } = await db.from('checklist_item')
        .delete().eq('id', String(body.itemId ?? '')).eq('daftar_id', id);
      if (error) return galat(error.message, 500);
      await sentuh();
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    default:
      return galat('Aksi tidak dikenal.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const jaga = await penjagaAkses(request);
  if ('galat' in jaga) return jaga.galat;
  const { error } = await jaga.db.from('checklist_daftar').delete().eq('id', params.id);
  if (error) return galat(error.message, 500);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
