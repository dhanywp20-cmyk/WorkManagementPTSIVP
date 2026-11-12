import type { TablesInsert } from '@/types/database';
import { BATAS, type ChecklistItem, type ChecklistRiwayat, type LewatCentang, type PerubahanItem } from './inti';
import { Db, KOLOM_ITEM, sentuh, RIWAYAT_KOLOM } from './server';

export function waktuSah(v: unknown, sekarang: number): string {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (Number.isNaN(t) || t > sekarang + 5 * 60_000 || t < sekarang - 14 * 86_400_000) return new Date(sekarang).toISOString();
  return new Date(t).toISOString();
}

export async function simpanPerubahan(
  db: Db, daftarId: string, masuk: unknown, nama: string, lewat: LewatCentang,
): Promise<{ galat: string; status: number } | { items: ChecklistItem[]; riwayat: ChecklistRiwayat[] }> {
  if (!Array.isArray(masuk) || masuk.length === 0) return { galat: 'Tidak ada perubahan untuk disimpan.', status: 400 };
  if (masuk.length > BATAS.perubahan) return { galat: `Maksimal ${BATAS.perubahan} perubahan per simpan.`, status: 400 };

  const perubahan = new Map<string, PerubahanItem>();
  for (const m of masuk as PerubahanItem[]) {
    if (m && typeof m.itemId === 'string') perubahan.set(m.itemId, m);
  }
  const ids = Array.from(perubahan.keys());
  const { data: rows, error } = await db.from('checklist_item').select('*').eq('daftar_id', daftarId).in('id', ids);
  if (error) return { galat: error.message, status: 500 };
  const asal = (rows ?? []) as (ChecklistItem & Record<string, unknown>)[];
  if (asal.length !== ids.length) return { galat: 'Sebagian item sudah tidak ada. Muat ulang checklist.', status: 409 };

  const sekarang = Date.now();
  const tulis: Record<string, unknown>[] = [];
  const riwayat: Record<string, unknown>[] = [];
  for (const it of asal) {
    const m = perubahan.get(it.id)!;
    const waktu = waktuSah(m.waktu, sekarang);
    const baru: Record<string, unknown> = { ...it };
    let berubah = false;

    if (typeof m.kendala === 'boolean') {
      const catatan = String(m.catatan ?? '').replace(/\r/g, '').trim().slice(0, BATAS.catatan);
      if (m.kendala) {
        if (!catatan) return { galat: `Kendala "${it.teks}" belum diberi keterangan.`, status: 400 };
        Object.assign(baru, { kendala: true, kendala_catatan: catatan, kendala_oleh: nama, kendala_pada: waktu,
          selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null });
        riwayat.push({ daftar_id: daftarId, item_id: it.id, teks_item: it.teks, aksi: 'kendala', nama, lewat, created_at: waktu });
        berubah = true;
      } else if (it.kendala) {
        baru.kendala = false;
        riwayat.push({ daftar_id: daftarId, item_id: it.id, teks_item: it.teks, aksi: 'kendala_selesai', nama, lewat, created_at: waktu });
        berubah = true;
      }
    }

    if (typeof m.selesai === 'boolean' && m.selesai !== baru.selesai) {
      if (m.selesai) {
        if (baru.kendala) riwayat.push({ daftar_id: daftarId, item_id: it.id, teks_item: it.teks, aksi: 'kendala_selesai', nama, lewat, created_at: waktu });
        Object.assign(baru, { selesai: true, selesai_oleh: nama, selesai_pada: waktu, selesai_lewat: lewat, kendala: false });
      } else {
        Object.assign(baru, { selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null });
      }
      riwayat.push({ daftar_id: daftarId, item_id: it.id, teks_item: it.teks, aksi: m.selesai ? 'centang' : 'batal', nama, lewat, created_at: waktu });
      berubah = true;
    }
    if (berubah) tulis.push(baru);
  }

  if (!tulis.length) return { items: [], riwayat: [] };
  const { data: hasil, error: uErr } = await db.from('checklist_item').upsert(tulis as TablesInsert<'checklist_item'>[], { onConflict: 'id' }).select(KOLOM_ITEM);
  if (uErr) return { galat: uErr.message, status: 500 };
  const { data: rw } = await db.from('checklist_riwayat').insert(riwayat as TablesInsert<'checklist_riwayat'>[]).select(RIWAYAT_KOLOM);
  await sentuh(db, daftarId);
  return {
    items: (hasil ?? []) as ChecklistItem[],
    riwayat: ((rw ?? []) as ChecklistRiwayat[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export const BUCKET = 'project-files';

export const BATAS_FOTO = 5 * 1024 * 1024;

export async function simpanFoto(db: Db, daftarId: string, itemId: string, form: FormData):
  Promise<{ galat: string; status: number } | { item: unknown }> {
  const full = form.get('full');
  const thumb = form.get('thumb');
  if (!(full instanceof Blob) || full.size === 0) return { galat: 'Foto tidak terbaca.', status: 400 };
  if (full.size > BATAS_FOTO || (thumb instanceof Blob && thumb.size > BATAS_FOTO)) {
    return { galat: 'Foto terlalu besar (maks 5 MB).', status: 400 };
  }
  if (!/^image\//.test(full.type)) return { galat: 'Berkas harus gambar.', status: 400 };

  const { data: item } = await db.from('checklist_item').select('id').eq('id', itemId).eq('daftar_id', daftarId).maybeSingle();
  if (!item) return { galat: 'Item tidak ditemukan.', status: 404 };

  const base = `project-progress/checklist/${daftarId}/${itemId}-${Date.now()}`;
  const ext = full.type === 'image/png' ? 'png' : full.type === 'image/webp' ? 'webp' : 'jpg';
  const up = await db.storage.from(BUCKET).upload(`${base}.${ext}`, full, { contentType: full.type, cacheControl: '31536000', upsert: false });
  if (up.error) return { galat: 'Unggah foto gagal: ' + up.error.message, status: 500 };
  const fullUrl = db.storage.from(BUCKET).getPublicUrl(`${base}.${ext}`).data.publicUrl;

  let thumbUrl = fullUrl;
  if (thumb instanceof Blob && thumb.size > 0) {
    const t = await db.storage.from(BUCKET).upload(`${base}-thumb.${ext}`, thumb, { contentType: thumb.type || full.type, cacheControl: '31536000', upsert: false });
    if (!t.error) thumbUrl = db.storage.from(BUCKET).getPublicUrl(`${base}-thumb.${ext}`).data.publicUrl;
  }

  const { data: baru, error } = await db.from('checklist_item')
    .update({ foto_url: fullUrl, foto_thumb_url: thumbUrl }).eq('id', itemId).select(KOLOM_ITEM).single();
  if (error) return { galat: error.message, status: 500 };
  await sentuh(db, daftarId);
  return { item: baru };
}
