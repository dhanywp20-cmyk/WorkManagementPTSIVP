import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from './supabase-admin';
import { getSessionUser, type SessionUser } from './server-auth';
import { bolehKelolaChecklist, type ChecklistDetail, type DraftChecklist, type LewatCentang, type SumberChecklist } from './checklist';

/**
 * lib/checklist-server.ts - bagian server Checklist Tools. JANGAN diimpor dari
 * komponen klien (memakai service role).
 *
 * Tabel checklist_* terkunci dari anon & authenticated (lihat migrasi
 * 024_checklist_tools.sql), jadi SEMUA akses lewat sini:
 *   - pengelola -> penjagaAkses() memeriksa sesi + hak menu Checklist Tools
 *                  (admin, Full Access, atau diberi menu di Admin Panel)
 *   - tim    -> share_token yang aktif, hanya baca + centang
 */

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export function galat(pesan: string, status = 400) {
  return NextResponse.json({ error: pesan }, { status, headers: NO_STORE });
}

export async function penjagaAkses(request: NextRequest):
  Promise<{ galat: NextResponse } | { pengguna: SessionUser; db: ReturnType<typeof getAdminClient> }> {
  const pengguna = await getSessionUser(request);
  if (!pengguna) return { galat: galat('Sesi tidak valid. Login ulang.', 401) };
  const db = getAdminClient();
  // Hak menu dibaca langsung dari DB setiap permintaan, bukan dari sesi di
  // browser: menu yang dicabut admin langsung berlaku tanpa menunggu logout.
  const { data: akun } = await db.from('users')
    .select('role, access_level, allowed_menus').eq('id', pengguna.id).maybeSingle();
  if (!bolehKelolaChecklist(akun)) {
    return { galat: galat('Akun Anda belum diberi akses menu Checklist Tools. Minta Admin mengaktifkannya.', 403) };
  }
  return { pengguna, db };
}

/** 32 hex char, sama dengan token share Project Progress. */
export function tokenBaru(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function tokenSah(token: string): boolean {
  return /^[a-f0-9]{32}$/i.test(token);
}

type Db = ReturnType<typeof getAdminClient>;

const KOLOM_DAFTAR = 'id,judul,keterangan,sumber,share_aktif,share_token,dibuat_oleh_nama,created_at,updated_at';
const KOLOM_ITEM = 'id,daftar_id,bagian_id,kelompok,teks,catatan,urutan,selesai,selesai_oleh,selesai_pada,selesai_lewat';

/**
 * Detail satu checklist. `untukPublik` membuang share_token dan riwayat:
 * halaman share tidak perlu tahu token-nya sendiri dari respons, dan riwayat
 * centang adalah bahan pantauan admin.
 */
export async function muatDetail(db: Db, daftarId: string, untukPublik: boolean): Promise<ChecklistDetail | null> {
  const { data: daftar, error } = await db.from('checklist_daftar').select(KOLOM_DAFTAR).eq('id', daftarId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!daftar) return null;

  const [bRes, iRes, rRes] = await Promise.all([
    db.from('checklist_bagian').select('id,daftar_id,judul,catatan,urutan').eq('daftar_id', daftarId).order('urutan'),
    db.from('checklist_item').select(KOLOM_ITEM).eq('daftar_id', daftarId).order('urutan'),
    untukPublik
      ? Promise.resolve({ data: [], error: null })
      : db.from('checklist_riwayat').select('id,item_id,teks_item,aksi,nama,lewat,created_at')
          .eq('daftar_id', daftarId).order('created_at', { ascending: false }).limit(50),
  ]);
  // Kegagalan query JANGAN ditelan jadi array kosong: checklist akan tampak
  // kosong padahal itemnya ada.
  if (bRes.error) throw new Error(bRes.error.message);
  if (iRes.error) throw new Error(iRes.error.message);

  return {
    daftar: untukPublik ? { ...daftar, share_token: null } : daftar,
    bagian: bRes.data ?? [],
    items: iRes.data ?? [],
    riwayat: rRes.error ? [] : (rRes.data ?? []),
  } as ChecklistDetail;
}

/**
 * Tulis checklist baru dari draf yang SUDAH divalidasi. Supabase REST tidak
 * punya transaksi lintas tabel, jadi kegagalan di tengah jalan dibereskan
 * dengan menghapus induknya (cascade ke bagian & item) - tidak ada checklist
 * setengah jadi yang tertinggal.
 */
export async function simpanDraft(
  db: Db, draft: DraftChecklist, sumber: SumberChecklist, oleh: SessionUser,
): Promise<string> {
  const { data: daftar, error } = await db.from('checklist_daftar').insert({
    judul: draft.judul,
    keterangan: draft.keterangan,
    sumber,
    dibuat_oleh: oleh.id,
    dibuat_oleh_nama: oleh.full_name || oleh.username,
  }).select('id').single();
  if (error || !daftar) throw new Error(error?.message ?? 'Gagal membuat checklist.');

  try {
    const { data: bagian, error: bErr } = await db.from('checklist_bagian')
      .insert(draft.bagian.map((b, i) => ({ daftar_id: daftar.id, judul: b.judul, catatan: b.catatan, urutan: i })))
      .select('id,urutan');
    if (bErr || !bagian) throw new Error(bErr?.message ?? 'Gagal menyimpan bagian.');

    const idBagian = new Map<number, string>(bagian.map((b: { id: string; urutan: number }) => [b.urutan, b.id]));
    const sekarang = new Date().toISOString();
    let urutan = 0;
    const items = draft.bagian.flatMap((b, i) => b.items.map(it => ({
      daftar_id: daftar.id,
      bagian_id: idBagian.get(i)!,
      kelompok: it.kelompok,
      teks: it.teks,
      catatan: it.catatan,
      urutan: urutan++,
      selesai: it.selesai,
      // Item yang sudah tercentang di sumbernya ([x] / Status Selesai) dicatat
      // sebagai centang admin pengimpor - bukan dibiarkan tanpa nama.
      selesai_oleh: it.selesai ? (oleh.full_name || oleh.username) : null,
      selesai_pada: it.selesai ? sekarang : null,
      selesai_lewat: it.selesai ? 'admin' : null,
    })));
    for (let i = 0; i < items.length; i += 500) {
      const { error: iErr } = await db.from('checklist_item').insert(items.slice(i, i + 500));
      if (iErr) throw new Error(iErr.message);
    }
    return daftar.id as string;
  } catch (e) {
    await db.from('checklist_daftar').delete().eq('id', daftar.id);
    throw e;
  }
}

/**
 * Centang / batal satu item + catat riwayatnya. `selesai` adalah NILAI TUJUAN,
 * bukan "balik": dua orang yang mencentang item yang sama hampir bersamaan
 * tidak saling membatalkan.
 */
export async function setCentang(
  db: Db, daftarId: string, itemId: string, selesai: boolean, nama: string, lewat: LewatCentang,
): Promise<{ galat: string; status: number } | { item: unknown }> {
  const { data: item } = await db.from('checklist_item').select('id,teks,selesai')
    .eq('id', itemId).eq('daftar_id', daftarId).maybeSingle();
  if (!item) return { galat: 'Item tidak ditemukan. Muat ulang halaman.', status: 404 };

  const sekarang = new Date().toISOString();
  const { data: baru, error } = await db.from('checklist_item').update(selesai
    ? { selesai: true, selesai_oleh: nama, selesai_pada: sekarang, selesai_lewat: lewat }
    : { selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null })
    .eq('id', itemId).select(KOLOM_ITEM).single();
  if (error) return { galat: error.message, status: 500 };

  if (item.selesai !== selesai) {
    await Promise.all([
      db.from('checklist_riwayat').insert({
        daftar_id: daftarId, item_id: itemId, teks_item: item.teks,
        aksi: selesai ? 'centang' : 'batal', nama, lewat,
      }),
      db.from('checklist_daftar').update({ updated_at: sekarang }).eq('id', daftarId),
    ]);
  }
  return { item: baru };
}
