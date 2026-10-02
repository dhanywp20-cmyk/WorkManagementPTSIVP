import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from './supabase-admin';
import { getSessionUser } from './server-auth';
import {
  statDari,
  type ChecklistAnggota, type ChecklistDetail, type ChecklistProyek, type ChecklistRingkas,
  type DraftChecklist, type HakChecklist, type LewatCentang, type ProyekDetail, type ProyekRingkas,
  type SumberChecklist,
} from './checklist';

/**
 * lib/checklist-server.ts - bagian server Project Progress (berbasis
 * checklist). JANGAN diimpor dari komponen klien (memakai service role).
 *
 * Semua TULIS lewat sini. Aturan hak:
 *   - Admin/superadmin   : buat & hapus proyek/checklist, ubah info proyek,
 *                          atur anggota, link share proyek.
 *   - Anggota checklist  : centang, kendala, foto, ubah/tambah/hapus item,
 *                          impor isi, link share checklist-nya.
 *   - Team (role team)   : melihat semua proyek (sama seperti Project Progress
 *                          lama, lihat is_progress_admin di basis data).
 *   - Sales              : melihat proyek yang mencatat namanya.
 *   - Tim lapangan tanpa akun: link share checklist (centang & kendala saja).
 */

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export function galat(pesan: string, status = 400) {
  return NextResponse.json({ error: pesan }, { status, headers: NO_STORE });
}

export type Db = ReturnType<typeof getAdminClient>;

export interface Akun {
  id: string;
  nama: string;
  role: string;
}

export function akunAdmin(a: Akun): boolean {
  return ['admin', 'superadmin'].includes(a.role.toLowerCase());
}

/** Melihat SEMUA proyek: admin & team - sama dengan is_progress_admin() di DB. */
export function akunLihatSemua(a: Akun): boolean {
  return ['admin', 'superadmin', 'team'].includes(a.role.toLowerCase());
}

function samaNama(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toLowerCase();
  return !!x && x === (b ?? '').trim().toLowerCase();
}

export async function ambilAkun(request: NextRequest):
  Promise<{ galat: NextResponse } | { akun: Akun; db: Db }> {
  const s = await getSessionUser(request);
  if (!s) return { galat: galat('Sesi tidak valid. Login ulang.', 401) };
  return {
    akun: { id: s.id, nama: (s.full_name || s.username || '').trim(), role: s.role ?? '' },
    db: getAdminClient(),
  };
}

/** 32 hex char, sama dengan token share Project Progress lama. */
export function tokenBaru(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function tokenSah(token: string): boolean {
  return /^[a-f0-9]{32}$/i.test(token);
}

/** Checklist dari token link share yang AKTIF; null = salah atau dimatikan. */
export async function cariChecklistShare(token: string): Promise<{ db: Db; id: string } | null> {
  if (!tokenSah(token)) return null;
  const db = getAdminClient();
  const { data } = await db.from('checklist_daftar')
    .select('id,share_aktif').eq('share_token', token).maybeSingle();
  if (!data || !data.share_aktif) return null;
  return { db, id: data.id as string };
}

const KOLOM_PROYEK = 'id,nama,client,deskripsi,sales_name,sales_division,status,start_date,target_date,origin,share_aktif,share_token,dibuat_oleh_nama,created_at,updated_at';
const KOLOM_DAFTAR = 'id,proyek_id,judul,keterangan,sumber,share_aktif,share_token,start_date,target_date,urutan,origin,dibuat_oleh_nama,created_at,updated_at';
export const KOLOM_ITEM = 'id,daftar_id,bagian_id,kelompok,teks,catatan,urutan,selesai,selesai_oleh,selesai_pada,selesai_lewat,kendala,kendala_catatan,kendala_oleh,kendala_pada,foto_url,foto_thumb_url';

/** Baca semua baris (PostgREST membatasi 1000 per permintaan). */
async function semuaBaris<T>(buat: (dari: number, sampai: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const hasil: T[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    hasil.push(...rows);
    if (rows.length < 1000) break;
  }
  return hasil;
}

type BarisDaftar = Omit<ChecklistRingkas, 'anggota' | 'stat' | 'saya'>;
type BarisItemStat = { daftar_id: string; selesai: boolean; kendala: boolean };

/** Daftar proyek yang boleh dilihat akun ini, lengkap dengan angka ringkasnya. */
export async function muatDaftarProyek(db: Db, akun: Akun): Promise<ProyekRingkas[]> {
  const [proyek, daftar, anggota, items] = await Promise.all([
    semuaBaris<ChecklistProyek>((a, b) => db.from('checklist_proyek').select(KOLOM_PROYEK).order('updated_at', { ascending: false }).range(a, b)),
    semuaBaris<BarisDaftar>((a, b) => db.from('checklist_daftar').select('id,proyek_id,target_date').order('id').range(a, b)),
    semuaBaris<ChecklistAnggota>((a, b) => db.from('checklist_anggota').select('daftar_id,user_id,nama').order('daftar_id').range(a, b)),
    semuaBaris<BarisItemStat>((a, b) => db.from('checklist_item').select('daftar_id,selesai,kendala').order('id').range(a, b)),
  ]);

  const itemPerDaftar = new Map<string, BarisItemStat[]>();
  for (const it of items) {
    const arr = itemPerDaftar.get(it.daftar_id) ?? [];
    arr.push(it);
    itemPerDaftar.set(it.daftar_id, arr);
  }
  const daftarSaya = new Set(anggota.filter(x => x.user_id === akun.id).map(x => x.daftar_id));
  const lihatSemua = akunLihatSemua(akun);
  const admin = akunAdmin(akun);

  return proyek.flatMap(p => {
    const milik = daftar.filter(d => d.proyek_id === p.id);
    const saya = milik.some(d => daftarSaya.has(d.id));
    if (!lihatSemua && !saya && !samaNama(p.sales_name, akun.nama)) return [];
    const semuaItem = milik.flatMap(d => itemPerDaftar.get(d.id) ?? []);
    const terbuka = milik.filter(d => {
      const st = statDari(itemPerDaftar.get(d.id) ?? []);
      return d.target_date && !(st.total > 0 && st.selesai === st.total);
    }).map(d => d.target_date as string).sort();
    return [{
      ...p,
      share_token: admin ? p.share_token : null,
      jumlah_checklist: milik.length,
      stat: statDari(semuaItem),
      target_terdekat: terbuka[0] ?? null,
      saya,
    }];
  });
}

/**
 * Detail satu proyek. Akun yang hanya terhubung lewat keanggotaan melihat
 * checklist miliknya saja - sama dengan aturan baca di basis data.
 */
export async function muatProyek(db: Db, akun: Akun, proyekId: string): Promise<ProyekDetail | 'tidak-ada' | 'terlarang'> {
  const { data: p, error } = await db.from('checklist_proyek').select(KOLOM_PROYEK).eq('id', proyekId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return 'tidak-ada';
  const proyek = p as ChecklistProyek;

  const { data: dRows, error: dErr } = await db.from('checklist_daftar').select(KOLOM_DAFTAR)
    .eq('proyek_id', proyekId).order('urutan').order('created_at');
  if (dErr) throw new Error(dErr.message);
  const daftar = (dRows ?? []) as BarisDaftar[];
  const ids = daftar.map(d => d.id);

  const [anggota, items] = ids.length ? await Promise.all([
    semuaBaris<ChecklistAnggota>((a, b) => db.from('checklist_anggota').select('daftar_id,user_id,nama').in('daftar_id', ids).order('nama').range(a, b)),
    semuaBaris<BarisItemStat>((a, b) => db.from('checklist_item').select('daftar_id,selesai,kendala').in('daftar_id', ids).order('id').range(a, b)),
  ]) : [[], []] as [ChecklistAnggota[], BarisItemStat[]];

  const admin = akunAdmin(akun);
  const lihatSemua = akunLihatSemua(akun) || samaNama(proyek.sales_name, akun.nama);
  const ringkas: ChecklistRingkas[] = daftar.map(d => {
    const ang = anggota.filter(a => a.daftar_id === d.id);
    const saya = ang.some(a => a.user_id === akun.id);
    return {
      ...d,
      share_token: admin || saya ? d.share_token ?? null : null,
      anggota: ang,
      stat: statDari(items.filter(i => i.daftar_id === d.id)),
      saya,
    };
  });
  const terlihat = lihatSemua ? ringkas : ringkas.filter(c => c.saya);
  if (!terlihat.length && !lihatSemua) return 'terlarang';

  return { proyek: { ...proyek, share_token: admin ? proyek.share_token : null }, checklist: terlihat, admin };
}

/** Hak akun terhadap satu checklist; null = tidak boleh melihat sama sekali. */
export async function hakAtas(db: Db, akun: Akun, daftarId: string):
  Promise<{ hak: HakChecklist; proyekId: string } | null> {
  const { data: d } = await db.from('checklist_daftar').select('id,proyek_id').eq('id', daftarId).maybeSingle();
  if (!d) return null;
  const admin = akunAdmin(akun);
  const { data: ang } = await db.from('checklist_anggota').select('user_id')
    .eq('daftar_id', daftarId).eq('user_id', akun.id).maybeSingle();
  if (admin || ang) return { hak: { admin, edit: true }, proyekId: d.proyek_id };
  if (akunLihatSemua(akun)) return { hak: { admin: false, edit: false }, proyekId: d.proyek_id };
  const { data: p } = await db.from('checklist_proyek').select('sales_name').eq('id', d.proyek_id).maybeSingle();
  if (p && samaNama(p.sales_name, akun.nama)) return { hak: { admin: false, edit: false }, proyekId: d.proyek_id };
  return null;
}

/**
 * Isi lengkap satu checklist. `publik` (link share) membuang token, anggota,
 * dan riwayat: halaman share tidak perlu tahu token-nya sendiri, dan riwayat
 * adalah bahan pantauan di dalam aplikasi.
 */
export async function muatChecklist(db: Db, daftarId: string, opsi: { publik: boolean; hak?: HakChecklist }): Promise<ChecklistDetail | null> {
  const { data: daftar, error } = await db.from('checklist_daftar').select(KOLOM_DAFTAR).eq('id', daftarId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!daftar) return null;

  const [pRes, aRes, bRes, items, rRes] = await Promise.all([
    db.from('checklist_proyek').select('id,nama,client,sales_name,sales_division,status').eq('id', daftar.proyek_id).single(),
    db.from('checklist_anggota').select('daftar_id,user_id,nama').eq('daftar_id', daftarId).order('nama'),
    db.from('checklist_bagian').select('id,daftar_id,judul,catatan,urutan').eq('daftar_id', daftarId).order('urutan'),
    semuaBaris((a, b) => db.from('checklist_item').select(KOLOM_ITEM).eq('daftar_id', daftarId).order('urutan').range(a, b)),
    opsi.publik
      ? Promise.resolve({ data: [], error: null })
      : db.from('checklist_riwayat').select('id,item_id,teks_item,aksi,nama,lewat,created_at')
          .eq('daftar_id', daftarId).order('created_at', { ascending: false }).limit(80),
  ]);
  // Kegagalan query JANGAN ditelan jadi array kosong: checklist akan tampak
  // kosong padahal itemnya ada.
  if (pRes.error) throw new Error(pRes.error.message);
  if (bRes.error) throw new Error(bRes.error.message);

  const tampilToken = !opsi.publik && !!opsi.hak?.edit;
  return {
    proyek: pRes.data,
    daftar: { ...daftar, share_token: tampilToken ? daftar.share_token : null },
    anggota: opsi.publik ? [] : (aRes.data ?? []),
    bagian: bRes.data ?? [],
    items,
    riwayat: rRes.error ? [] : (rRes.data ?? []),
    hak: opsi.hak,
  } as ChecklistDetail;
}

/** Perbarui updated_at checklist & proyeknya - urutan "terakhir diperbarui" ikut benar. */
export async function sentuh(db: Db, daftarId: string, proyekId?: string) {
  const sekarang = new Date().toISOString();
  let pid = proyekId;
  if (!pid) {
    const { data } = await db.from('checklist_daftar').select('proyek_id').eq('id', daftarId).maybeSingle();
    pid = data?.proyek_id;
  }
  await Promise.all([
    db.from('checklist_daftar').update({ updated_at: sekarang }).eq('id', daftarId),
    pid ? db.from('checklist_proyek').update({ updated_at: sekarang }).eq('id', pid) : Promise.resolve(),
  ]);
}

/**
 * Tambahkan bagian & item dari draf impor ke checklist yang SUDAH ada, di
 * belakang isi yang sudah ada. Draf sudah divalidasi (validasiDraft).
 */
export async function tambahIsi(db: Db, daftarId: string, draft: DraftChecklist, olehNama: string): Promise<number> {
  const [{ data: bAkhir }, { data: iAkhir }] = await Promise.all([
    db.from('checklist_bagian').select('urutan').eq('daftar_id', daftarId).order('urutan', { ascending: false }).limit(1).maybeSingle(),
    db.from('checklist_item').select('urutan').eq('daftar_id', daftarId).order('urutan', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const mulaiBagian = (bAkhir?.urutan ?? -1) + 1;
  let urutan = (iAkhir?.urutan ?? -1) + 1;

  const { data: bagian, error: bErr } = await db.from('checklist_bagian')
    .insert(draft.bagian.map((b, i) => ({ daftar_id: daftarId, judul: b.judul, catatan: b.catatan, urutan: mulaiBagian + i })))
    .select('id,urutan');
  if (bErr || !bagian) throw new Error(bErr?.message ?? 'Gagal menyimpan bagian.');
  const idBagian = new Map<number, string>(bagian.map((b: { id: string; urutan: number }) => [b.urutan, b.id]));

  const sekarang = new Date().toISOString();
  const items = draft.bagian.flatMap((b, i) => b.items.map(it => ({
    daftar_id: daftarId,
    bagian_id: idBagian.get(mulaiBagian + i)!,
    kelompok: it.kelompok, teks: it.teks, catatan: it.catatan,
    urutan: urutan++,
    selesai: it.selesai,
    // Item yang sudah tercentang di sumbernya ([x] / Status Selesai) dicatat
    // atas nama pengimpor - bukan dibiarkan tanpa nama.
    selesai_oleh: it.selesai ? olehNama : null,
    selesai_pada: it.selesai ? sekarang : null,
    selesai_lewat: it.selesai ? 'admin' : null,
  })));
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await db.from('checklist_item').insert(items.slice(i, i + 500));
    if (error) {
      // Jangan tinggalkan bagian setengah jadi dari impor yang gagal di tengah.
      await db.from('checklist_bagian').delete().in('id', bagian.map((b: { id: string }) => b.id));
      throw new Error(error.message);
    }
  }
  return items.length;
}

/** Ganti seluruh anggota checklist. Nama diambil dari akun, bukan dari klien. */
export async function aturAnggota(db: Db, daftarId: string, userIds: string[]): Promise<ChecklistAnggota[]> {
  const unik = Array.from(new Set(userIds.filter(x => typeof x === 'string' && x))).slice(0, 50);
  const { data: users, error } = unik.length
    ? await db.from('users').select('id,full_name,username').in('id', unik)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const baris = ((users ?? []) as { id: string; full_name: string | null; username: string }[]).map(u => ({
    daftar_id: daftarId, user_id: u.id, nama: (u.full_name || u.username || '').trim() || 'Tanpa nama',
  }));
  const { error: delErr } = await db.from('checklist_anggota').delete().eq('daftar_id', daftarId);
  if (delErr) throw new Error(delErr.message);
  if (baris.length) {
    const { error: insErr } = await db.from('checklist_anggota').insert(baris);
    if (insErr) throw new Error(insErr.message);
  }
  return baris;
}

/**
 * Buat checklist baru di sebuah proyek. Supabase REST tidak punya transaksi
 * lintas tabel, jadi kegagalan di tengah dibereskan dengan menghapus
 * checklist-nya (cascade ke bagian, item, anggota).
 */
export async function buatChecklist(db: Db, proyekId: string, data: {
  judul: string; keterangan: string; start_date: string | null; target_date: string | null;
  sumber: SumberChecklist; anggota: string[]; origin?: 'manual' | 'auto_reminder'; source_reminder_id?: string | null;
}, draft: DraftChecklist | null, oleh: Akun): Promise<string> {
  const { data: akhir } = await db.from('checklist_daftar').select('urutan')
    .eq('proyek_id', proyekId).order('urutan', { ascending: false }).limit(1).maybeSingle();
  const { data: d, error } = await db.from('checklist_daftar').insert({
    proyek_id: proyekId, judul: data.judul, keterangan: data.keterangan, sumber: data.sumber,
    start_date: data.start_date, target_date: data.target_date, urutan: (akhir?.urutan ?? -1) + 1,
    origin: data.origin ?? 'manual', source_reminder_id: data.source_reminder_id ?? null,
    dibuat_oleh: oleh.id || null, dibuat_oleh_nama: oleh.nama,
  }).select('id').single();
  if (error || !d) throw new Error(error?.message ?? 'Gagal membuat checklist.');
  try {
    await aturAnggota(db, d.id, data.anggota);
    if (draft && draft.bagian.length) await tambahIsi(db, d.id, draft, oleh.nama);
    await sentuh(db, d.id, proyekId);
    return d.id as string;
  } catch (e) {
    await db.from('checklist_daftar').delete().eq('id', d.id);
    throw e;
  }
}

async function catatRiwayat(db: Db, daftarId: string, itemId: string, teks: string,
  aksi: 'centang' | 'batal' | 'kendala' | 'kendala_selesai', nama: string, lewat: LewatCentang) {
  await db.from('checklist_riwayat').insert({ daftar_id: daftarId, item_id: itemId, teks_item: teks, aksi, nama, lewat });
}

/**
 * Centang / batal satu item. `selesai` adalah NILAI TUJUAN, bukan "balik":
 * dua orang yang mencentang item yang sama hampir bersamaan tidak saling
 * membatalkan. Item yang diselesaikan otomatis lepas dari kendalanya.
 */
export async function setCentang(
  db: Db, daftarId: string, itemId: string, selesai: boolean, nama: string, lewat: LewatCentang,
): Promise<{ galat: string; status: number } | { item: unknown }> {
  const { data: item } = await db.from('checklist_item').select('id,teks,selesai,kendala')
    .eq('id', itemId).eq('daftar_id', daftarId).maybeSingle();
  if (!item) return { galat: 'Item tidak ditemukan. Muat ulang halaman.', status: 404 };

  const sekarang = new Date().toISOString();
  const { data: baru, error } = await db.from('checklist_item').update(selesai
    ? { selesai: true, selesai_oleh: nama, selesai_pada: sekarang, selesai_lewat: lewat, kendala: false }
    : { selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null })
    .eq('id', itemId).select(KOLOM_ITEM).single();
  if (error) return { galat: error.message, status: 500 };

  if (item.selesai !== selesai) {
    await Promise.all([
      catatRiwayat(db, daftarId, itemId, item.teks, selesai ? 'centang' : 'batal', nama, lewat),
      selesai && item.kendala ? catatRiwayat(db, daftarId, itemId, item.teks, 'kendala_selesai', nama, lewat) : Promise.resolve(),
      sentuh(db, daftarId),
    ]);
  }
  return { item: baru };
}

/** Tandai / lepas kendala. Menandai kendala membatalkan centang selesai. */
export async function setKendala(
  db: Db, daftarId: string, itemId: string, kendala: boolean, catatan: string, nama: string, lewat: LewatCentang,
): Promise<{ galat: string; status: number } | { item: unknown }> {
  const { data: item } = await db.from('checklist_item').select('id,teks,kendala')
    .eq('id', itemId).eq('daftar_id', daftarId).maybeSingle();
  if (!item) return { galat: 'Item tidak ditemukan. Muat ulang halaman.', status: 404 };

  const sekarang = new Date().toISOString();
  const { data: baru, error } = await db.from('checklist_item').update(kendala
    ? {
        kendala: true, kendala_catatan: catatan, kendala_oleh: nama, kendala_pada: sekarang,
        selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null,
      }
    : { kendala: false })
    .eq('id', itemId).select(KOLOM_ITEM).single();
  if (error) return { galat: error.message, status: 500 };

  // Catatan kendala yang diperbarui juga dicatat: siapa menambah keterangan, kapan.
  if (item.kendala !== kendala || kendala) {
    await Promise.all([
      catatRiwayat(db, daftarId, itemId, item.teks, kendala ? 'kendala' : 'kendala_selesai', nama, lewat),
      sentuh(db, daftarId),
    ]);
  }
  return { item: baru };
}

const BUCKET = 'project-files';
const BATAS_FOTO = 5 * 1024 * 1024;

/**
 * Simpan foto bukti satu item (full + thumb, keduanya sudah dikompres di
 * peramban). Dipakai dari aplikasi maupun link share - jalurnya sama-sama
 * lewat server, jadi tidak ada izin unggah storage yang dibuka ke anon.
 */
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
    // Thumbnail gagal bukan alasan membatalkan - jatuh balik ke foto penuh.
    if (!t.error) thumbUrl = db.storage.from(BUCKET).getPublicUrl(`${base}-thumb.${ext}`).data.publicUrl;
  }

  const { data: baru, error } = await db.from('checklist_item')
    .update({ foto_url: fullUrl, foto_thumb_url: thumbUrl }).eq('id', itemId).select(KOLOM_ITEM).single();
  if (error) return { galat: error.message, status: 500 };
  await sentuh(db, daftarId);
  return { item: baru };
}
