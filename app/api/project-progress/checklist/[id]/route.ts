import { NextRequest, NextResponse } from 'next/server';
import {
  KOLOM_ITEM, NO_STORE, ambilAkun, aturAnggota, galat, hakAtas, kabariAnggotaBaru, muatChecklist, sentuh,
  simpanPerubahan, tambahIsi, tokenBaru,
} from '@/lib/checklist-server';
import { daftarId, tanggal, teks } from '@/lib/checklist-isian';
import { BATAS, validasiDraft } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/project-progress/checklist/<id> - satu checklist lokasi.
 *   GET    -> isi lengkap + hak akun ini + riwayat
 *   PATCH  -> { aksi, ... } - lihat cabang di bawah. Centang & kendala
 *             dikirim berkelompok lewat aksi 'simpan', bukan per klik.
 *   DELETE -> admin: hapus checklist
 *
 * Admin: semua aksi. Anggota (yang di-assign): semua kecuali ubah info
 * checklist, atur anggota, dan hapus.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  try {
    const akses = await hakAtas(s.db, s.akun, params.id);
    if (!akses) return galat('Checklist tidak ditemukan atau Anda tidak punya akses.', 404);
    const detail = await muatChecklist(s.db, params.id, { publik: false, hak: akses.hak });
    if (!detail) return galat('Checklist tidak ditemukan.', 404);
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat checklist.', 500);
  }
}

const KHUSUS_ADMIN = new Set(['ubahInfo', 'anggota']);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const { db, akun } = s;
  const id = params.id;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const akses = await hakAtas(db, akun, id);
  if (!akses) return galat('Checklist tidak ditemukan.', 404);
  const aksi = String(body.aksi ?? '');
  if (KHUSUS_ADMIN.has(aksi) ? !akses.hak.admin : !akses.hak.edit) {
    return galat(KHUSUS_ADMIN.has(aksi)
      ? 'Hanya admin yang bisa mengubah info dan anggota checklist.'
      : 'Anda tidak di-assign ke checklist ini, jadi hanya bisa melihat.', 403);
  }
  const ok = (data: Record<string, unknown> = { ok: true }) => NextResponse.json(data, { headers: NO_STORE });

  switch (aksi) {
    case 'ubahInfo': {
      const judul = teks(body.judul, BATAS.judul);
      if (!judul) return galat('Nama lokasi / checklist wajib diisi.');
      const start_date = tanggal(body.start_date);
      const target_date = tanggal(body.target_date);
      if (start_date && target_date && target_date < start_date) return galat('Tanggal target tidak boleh sebelum tanggal mulai.');
      const { error } = await db.from('checklist_daftar')
        .update({ judul, keterangan: teks(body.keterangan, BATAS.keterangan), start_date, target_date }).eq('id', id);
      if (error) return galat(error.message, 500);
      await sentuh(db, id, akses.proyekId);
      return ok();
    }

    case 'anggota': {
      try {
        const { anggota, baru } = await aturAnggota(db, id, daftarId(body.anggota));
        await sentuh(db, id, akses.proyekId);
        // Yang baru di-assign dikabari lewat Telegram pribadinya.
        const kabar = await kabariAnggotaBaru(db, id, baru, { baseUrl: request.nextUrl.origin, oleh: akun.nama });
        return ok({ anggota, kabar });
      } catch (e) {
        return galat(e instanceof Error ? e.message : 'Gagal menyimpan anggota.', 500);
      }
    }

    case 'share': {
      const { data: d } = await db.from('checklist_daftar').select('share_token').eq('id', id).single();
      const share_token = d?.share_token ?? tokenBaru();
      const share_aktif = body.aktif === true;
      const { error } = await db.from('checklist_daftar').update({ share_aktif, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return ok({ share_aktif, share_token });
    }

    case 'tokenBaru': {
      const share_token = tokenBaru();
      const { error } = await db.from('checklist_daftar').update({ share_aktif: true, share_token }).eq('id', id);
      if (error) return galat(error.message, 500);
      return ok({ share_aktif: true, share_token });
    }

    case 'simpan': {
      // Semua centang & kendala satu sesi kerja dalam SATU permintaan.
      const hasil = await simpanPerubahan(db, id, body.perubahan, akun.nama, 'admin');
      if ('galat' in hasil) return galat(hasil.galat, hasil.status);
      return ok(hasil);
    }

    case 'hapusFoto': {
      const { data: item, error } = await db.from('checklist_item')
        .update({ foto_url: null, foto_thumb_url: null })
        .eq('id', String(body.itemId ?? '')).eq('daftar_id', id).select(KOLOM_ITEM).maybeSingle();
      if (error) return galat(error.message, 500);
      if (!item) return galat('Item tidak ditemukan.', 404);
      return ok({ item });
    }

    case 'ubahBagian': {
      const judul = teks(body.judul, BATAS.judul);
      if (!judul) return galat('Judul bagian wajib diisi.');
      const { error } = await db.from('checklist_bagian')
        .update({ judul, catatan: teks(body.catatan, BATAS.catatan) })
        .eq('id', String(body.bagianId ?? '')).eq('daftar_id', id);
      if (error) return galat(error.message, 500);
      await sentuh(db, id, akses.proyekId);
      return ok();
    }

    case 'tambahBagian': {
      const judul = teks(body.judul, BATAS.judul);
      if (!judul) return galat('Judul bagian wajib diisi.');
      const { data: akhir } = await db.from('checklist_bagian').select('urutan')
        .eq('daftar_id', id).order('urutan', { ascending: false }).limit(1).maybeSingle();
      const { data: bagian, error } = await db.from('checklist_bagian')
        .insert({ daftar_id: id, judul, catatan: '', urutan: (akhir?.urutan ?? -1) + 1 }).select('*').single();
      if (error) return galat(error.message, 500);
      await sentuh(db, id, akses.proyekId);
      return ok({ bagian });
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
      }).select(KOLOM_ITEM).single();
      if (error) return galat(error.message, 500);
      await sentuh(db, id, akses.proyekId);
      return ok({ item });
    }

    case 'ubahItem': {
      const isi = teks(body.teks, BATAS.teks);
      if (!isi) return galat('Teks item wajib diisi.');
      const { data: item, error } = await db.from('checklist_item')
        .update({ teks: isi, kelompok: teks(body.kelompok, BATAS.judul), catatan: teks(body.catatan, BATAS.catatan) })
        .eq('id', String(body.itemId ?? '')).eq('daftar_id', id).select(KOLOM_ITEM).maybeSingle();
      if (error) return galat(error.message, 500);
      if (!item) return galat('Item tidak ditemukan.', 404);
      await sentuh(db, id, akses.proyekId);
      return ok({ item });
    }

    case 'hapusItem': {
      const { error } = await db.from('checklist_item')
        .delete().eq('id', String(body.itemId ?? '')).eq('daftar_id', id);
      if (error) return galat(error.message, 500);
      await sentuh(db, id, akses.proyekId);
      return ok();
    }

    case 'impor': {
      const hasil = validasiDraft({ ...((body.draft ?? {}) as object), judul: 'impor' });
      if ('galat' in hasil) return galat(hasil.galat);
      const { count } = await db.from('checklist_item').select('id', { count: 'exact', head: true }).eq('daftar_id', id);
      const jumlahBaru = hasil.draft.bagian.reduce((n, b) => n + b.items.length, 0);
      if ((count ?? 0) + jumlahBaru > BATAS.item) return galat(`Maksimal ${BATAS.item} item per checklist.`);
      try {
        const n = await tambahIsi(db, id, hasil.draft, akun.nama);
        await sentuh(db, id, akses.proyekId);
        return ok({ jumlah: n });
      } catch (e) {
        return galat(e instanceof Error ? e.message : 'Gagal mengimpor.', 500);
      }
    }

    default:
      return galat('Aksi tidak dikenal.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const akses = await hakAtas(s.db, s.akun, params.id);
  if (!akses) return galat('Checklist tidak ditemukan.', 404);
  if (!akses.hak.admin) return galat('Hanya admin yang bisa menghapus checklist.', 403);
  const { error } = await s.db.from('checklist_daftar').delete().eq('id', params.id);
  if (error) return galat(error.message, 500);
  await s.db.from('checklist_proyek').update({ updated_at: new Date().toISOString() }).eq('id', akses.proyekId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
