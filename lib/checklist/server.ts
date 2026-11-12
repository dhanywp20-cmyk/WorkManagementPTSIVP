import type { NextRequest } from 'next/server';
import { aktivitasProyek, type ItemSelesai } from '@/lib/checklist/ringkasan';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '../supabase-admin';
import { getSessionUser } from '../auth/server';
import { bacaRahasia } from '../auth/rahasia-server';
import { bacaPengaturan } from '../notifikasi/pengaturan';
import { formatTanggal, statusLokasiDari, type ChecklistAnggota, type ChecklistDetail, type ChecklistProyek, type ChecklistRingkas, type DraftChecklist, type HakChecklist, type ProyekDetail, type ProyekRingkas, type StatChecklist, type SumberChecklist } from './inti';

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
  pimpinan?: boolean;
}

export function akunAdmin(a: Akun): boolean {
  return ['admin', 'superadmin'].includes(a.role.toLowerCase());
}

export function akunLihatSemua(a: Akun): boolean {
  return ['admin', 'superadmin', 'team'].includes(a.role.toLowerCase());
}

export function akunBacaSemua(a: Akun): boolean {
  return akunLihatSemua(a) || a.pimpinan === true;
}

function samaNama(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toLowerCase();
  return !!x && x === (b ?? '').trim().toLowerCase();
}

export async function ambilAkun(request: NextRequest):
  Promise<{ galat: NextResponse } | { akun: Akun; db: Db }> {
  const s = await getSessionUser(request);
  if (!s) return { galat: galat('Sesi tidak valid. Login ulang.', 401) };
  const db = getAdminClient();
  const { data: pim } = await db.from('users').select('pimpinan').eq('id', s.id).maybeSingle();
  return {
    akun: { id: s.id, nama: (s.full_name || s.username || '').trim(), role: s.role ?? '', pimpinan: (pim as { pimpinan?: boolean } | null)?.pimpinan === true },
    db,
  };
}

export function tokenBaru(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function tokenSah(token: string): boolean {
  return /^[a-f0-9]{32}$/i.test(token);
}

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

export async function supportPerDaftar(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await db.from('checklist_daftar').select('id,support_lokasi').in('id', ids);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; support_lokasi: string | null }[]).map(r => [r.id, (r.support_lokasi ?? '').trim()]));
}

type BarisDaftar = Omit<ChecklistRingkas, 'anggota' | 'stat' | 'saya'>;
type BarisStat = StatChecklist & { daftar_id: string };

const STAT_KOSONG: StatChecklist = { total: 0, selesai: 0, kendala: 0 };

function jumlahkan(list: StatChecklist[]): StatChecklist {
  return list.reduce((a, s) => ({ total: a.total + s.total, selesai: a.selesai + s.selesai, kendala: a.kendala + s.kendala }), STAT_KOSONG);
}

export async function statPerDaftar(db: Db, ids?: string[]): Promise<Map<string, StatChecklist>> {
  if (ids && !ids.length) return new Map();
  const rows = await semuaBaris<BarisStat>((a, b) => {
    let q = db.from('checklist_stat_daftar').select('daftar_id,total,selesai,kendala');
    if (ids) q = q.in('daftar_id', ids);
    return q.order('daftar_id').range(a, b);
  });
  return new Map(rows.map(r => [r.daftar_id, { total: r.total, selesai: r.selesai, kendala: r.kendala }]));
}

export async function muatDaftarProyek(db: Db, akun: Akun): Promise<ProyekRingkas[]> {
  const [proyek, daftar, anggota, stat] = await Promise.all([
    semuaBaris<ChecklistProyek>((a, b) => db.from('checklist_proyek').select(KOLOM_PROYEK).order('updated_at', { ascending: false }).range(a, b)),
    semuaBaris<BarisDaftar>((a, b) => db.from('checklist_daftar').select('id,proyek_id,target_date').order('id').range(a, b)),
    semuaBaris<ChecklistAnggota>((a, b) => db.from('checklist_anggota').select('daftar_id,user_id,nama').order('daftar_id').range(a, b)),
    statPerDaftar(db),
  ]);

  const daftarSaya = new Set(anggota.filter(x => x.user_id === akun.id).map(x => x.daftar_id));
  const lihatSemua = akunBacaSemua(akun);
  const admin = akunAdmin(akun);

  return proyek.flatMap(p => {
    const milik = daftar.filter(d => d.proyek_id === p.id);
    const saya = milik.some(d => daftarSaya.has(d.id));
    if (!lihatSemua && !saya && !samaNama(p.sales_name, akun.nama)) return [];
    const terbuka = milik.filter(d => {
      const st = stat.get(d.id) ?? STAT_KOSONG;
      return d.target_date && !(st.total > 0 && st.selesai === st.total);
    }).map(d => d.target_date as string).sort();
    return [{
      ...p,
      share_token: admin ? p.share_token : null,
      jumlah_checklist: milik.length,
      stat: jumlahkan(milik.map(d => stat.get(d.id) ?? STAT_KOSONG)),
      lokasi: milik.reduce((a, d) => { a[statusLokasiDari(stat.get(d.id) ?? STAT_KOSONG)]++; return a; }, { selesai: 0, berjalan: 0, belum: 0, kosong: 0 }),
      target_terdekat: terbuka[0] ?? null,
      saya,
    }];
  });
}

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

  const [anggota, stat, support] = ids.length ? await Promise.all([
    semuaBaris<ChecklistAnggota>((a, b) => db.from('checklist_anggota').select('daftar_id,user_id,nama').in('daftar_id', ids).order('nama').range(a, b)),
    statPerDaftar(db, ids),
    supportPerDaftar(db, ids),
  ]) : [[], new Map(), new Map()] as [ChecklistAnggota[], Map<string, StatChecklist>, Map<string, string>];

  const admin = akunAdmin(akun);
  const lihatSemua = akunBacaSemua(akun) || samaNama(proyek.sales_name, akun.nama);
  const ringkas: ChecklistRingkas[] = daftar.map(d => {
    const ang = anggota.filter(a => a.daftar_id === d.id);
    const saya = ang.some(a => a.user_id === akun.id);
    return {
      ...d,
      support_lokasi: support.get(d.id) ?? '',
      share_token: admin || saya ? d.share_token ?? null : null,
      anggota: ang,
      stat: stat.get(d.id) ?? STAT_KOSONG,
      saya,
    };
  });
  const terlihat = lihatSemua ? ringkas : ringkas.filter(c => c.saya);
  if (!terlihat.length && !lihatSemua) return 'terlarang';

  const idTerlihat = terlihat.map(c => c.id);
  const selesai = idTerlihat.length
    ? await semuaBaris<ItemSelesai>((a, b) => db.from('checklist_item').select('daftar_id,selesai,selesai_oleh,selesai_pada')
        .in('daftar_id', idTerlihat).eq('selesai', true).order('id').range(a, b))
    : [];
  const aktivitas = aktivitasProyek(selesai, anggota.filter(a => idTerlihat.includes(a.daftar_id)));

  return { proyek: { ...proyek, share_token: admin ? proyek.share_token : null }, checklist: terlihat, admin, aktivitas };
}

export async function bolehLihatProyek(db: Db, akun: Akun, proyekId: string): Promise<boolean | 'tidak-ada'> {
  const { data: p } = await db.from('checklist_proyek').select('id,sales_name').eq('id', proyekId).maybeSingle();
  if (!p) return 'tidak-ada';
  if (akunBacaSemua(akun) || samaNama(p.sales_name, akun.nama)) return true;
  const { data: d } = await db.from('checklist_daftar').select('id').eq('proyek_id', proyekId);
  const ids = ((d ?? []) as { id: string }[]).map(x => x.id);
  if (!ids.length) return false;
  const { count } = await db.from('checklist_anggota').select('daftar_id', { count: 'exact', head: true }).in('daftar_id', ids).eq('user_id', akun.id);
  return (count ?? 0) > 0;
}

export async function hakAtas(db: Db, akun: Akun, daftarId: string):
  Promise<{ hak: HakChecklist; proyekId: string } | null> {
  const { data: d } = await db.from('checklist_daftar').select('id,proyek_id').eq('id', daftarId).maybeSingle();
  if (!d) return null;
  const admin = akunAdmin(akun);
  const { data: ang } = await db.from('checklist_anggota').select('user_id')
    .eq('daftar_id', daftarId).eq('user_id', akun.id).maybeSingle();
  if (admin || ang) return { hak: { admin, edit: true }, proyekId: d.proyek_id };
  if (akunBacaSemua(akun)) return { hak: { admin: false, edit: false }, proyekId: d.proyek_id };
  const { data: p } = await db.from('checklist_proyek').select('sales_name').eq('id', d.proyek_id).maybeSingle();
  if (p && samaNama(p.sales_name, akun.nama)) return { hak: { admin: false, edit: false }, proyekId: d.proyek_id };
  return null;
}

export async function muatChecklist(db: Db, daftarId: string, opsi: { publik: boolean; hak?: HakChecklist }): Promise<ChecklistDetail | null> {
  const { data: daftar, error } = await db.from('checklist_daftar').select(KOLOM_DAFTAR).eq('id', daftarId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!daftar) return null;

  const [pRes, aRes, bRes, items, rRes, support] = await Promise.all([
    db.from('checklist_proyek').select('id,nama,client,sales_name,sales_division,status').eq('id', daftar.proyek_id).single(),
    db.from('checklist_anggota').select('daftar_id,user_id,nama').eq('daftar_id', daftarId).order('nama'),
    db.from('checklist_bagian').select('id,daftar_id,judul,catatan,urutan').eq('daftar_id', daftarId).order('urutan'),
    semuaBaris((a, b) => db.from('checklist_item').select(KOLOM_ITEM).eq('daftar_id', daftarId).order('urutan').range(a, b)),
    opsi.publik
      ? Promise.resolve({ data: [], error: null })
      : db.from('checklist_riwayat').select('id,item_id,teks_item,aksi,nama,lewat,created_at')
          .eq('daftar_id', daftarId).order('created_at', { ascending: false }).limit(80),
    supportPerDaftar(db, [daftarId]),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (bRes.error) throw new Error(bRes.error.message);

  const tampilToken = !opsi.publik && !!opsi.hak?.edit;
  return {
    proyek: pRes.data,
    daftar: { ...daftar, support_lokasi: support.get(daftarId) ?? '', share_token: tampilToken ? daftar.share_token : null },
    anggota: opsi.publik
      ? ((aRes.data ?? []) as ChecklistAnggota[]).map(x => ({ daftar_id: x.daftar_id, user_id: '', nama: x.nama }))
      : (aRes.data ?? []),
    bagian: bRes.data ?? [],
    items,
    riwayat: rRes.error ? [] : (rRes.data ?? []),
    hak: opsi.hak,
  } as ChecklistDetail;
}

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
    selesai_oleh: it.selesai ? olehNama : null,
    selesai_pada: it.selesai ? sekarang : null,
    selesai_lewat: it.selesai ? 'admin' : null,
  })));
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await db.from('checklist_item').insert(items.slice(i, i + 500));
    if (error) {
      await db.from('checklist_bagian').delete().in('id', bagian.map((b: { id: string }) => b.id));
      throw new Error(error.message);
    }
  }
  return items.length;
}

export async function aturAnggota(db: Db, daftarId: string, userIds: string[]): Promise<{ anggota: ChecklistAnggota[]; baru: string[] }> {
  const { data: lama } = await db.from('checklist_anggota').select('user_id').eq('daftar_id', daftarId);
  const sudah = new Set(((lama ?? []) as { user_id: string }[]).map(x => x.user_id));
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
  return { anggota: baris, baru: baris.map(b => b.user_id).filter(id => !sudah.has(id)) };
}

export async function kabariAnggotaBaru(db: Db, daftarId: string, userIds: string[], opsi: { baseUrl: string; oleh: string }):
  Promise<{ terkirim: number; tanpaTelegram: number }> {
  const hasil = { terkirim: 0, tanpaTelegram: 0 };
  if (!userIds.length) return hasil;
  try {
    const [token, pengaturan] = await Promise.all([bacaRahasia('telegram.bot_token'), bacaPengaturan()]);
    if (!token || !pengaturan.aktif.telegram) return hasil;

    const [{ data: users }, { data: d }, stat] = await Promise.all([
      db.from('users').select('id,full_name,telegram_chat_id').in('id', userIds),
      db.from('checklist_daftar').select('judul,start_date,target_date,proyek_id').eq('id', daftarId).single(),
      statPerDaftar(db, [daftarId]),
    ]);
    if (!d) return hasil;
    const { data: p } = await db.from('checklist_proyek').select('nama,client').eq('id', d.proyek_id).single();
    const st = stat.get(daftarId) ?? STAT_KOSONG;
    const jadwal = d.start_date || d.target_date ? `${formatTanggal(d.start_date)} - ${formatTanggal(d.target_date)}` : 'belum dijadwalkan';

    for (const u of (users ?? []) as { id: string; full_name: string | null; telegram_chat_id: string | null }[]) {
      if (!u.telegram_chat_id) { hasil.tanpaTelegram++; continue; }
      const pesan = [
        `Halo ${u.full_name ?? ''}, Anda di-assign ke checklist Project Progress.`,
        '',
        `Proyek : ${p?.nama ?? '-'}${p?.client ? ` (${p.client})` : ''}`,
        `Lokasi : ${d.judul}`,
        `Jadwal : ${jadwal}`,
        `Isi    : ${st.total} item${st.selesai ? `, ${st.selesai} sudah selesai` : ''}`,
        `Oleh   : ${opsi.oleh}`,
        '',
        `Buka: ${opsi.baseUrl}/dashboard (menu Project Progress)`,
      ].join('\n');
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: u.telegram_chat_id, text: pesan }),
        });
        if ((await r.json().catch(() => ({})))?.ok) hasil.terkirim++;
      } catch {  }
    }
  } catch {  }
  return hasil;
}

export async function buatChecklist(db: Db, proyekId: string, data: {
  judul: string; keterangan: string; start_date: string | null; target_date: string | null;
  sumber: SumberChecklist; anggota: string[]; origin?: 'manual' | 'auto_reminder'; source_reminder_id?: string | null;
}, draft: DraftChecklist | null, oleh: Akun, kabari?: { baseUrl: string }): Promise<string> {
  const { data: akhir } = await db.from('checklist_daftar').select('urutan')
    .eq('proyek_id', proyekId).order('urutan', { ascending: false }).limit(1).maybeSingle();
  const { data: d, error } = await db.from('checklist_daftar').insert({
    proyek_id: proyekId, judul: data.judul, keterangan: data.keterangan, sumber: data.sumber,
    start_date: data.start_date, target_date: data.target_date, urutan: (akhir?.urutan ?? -1) + 1,
    origin: data.origin ?? 'manual', source_reminder_id: data.source_reminder_id ?? null,
    dibuat_oleh: oleh.id || null, dibuat_oleh_nama: oleh.nama,
  }).select('id').single();
  if (error || !d) throw new Error(error?.message ?? 'Gagal membuat checklist.');
  let baru: string[] = [];
  try {
    baru = (await aturAnggota(db, d.id, data.anggota)).baru;
    if (draft && draft.bagian.length) await tambahIsi(db, d.id, draft, oleh.nama);
    await sentuh(db, d.id, proyekId);
  } catch (e) {
    await db.from('checklist_daftar').delete().eq('id', d.id);
    throw e;
  }
  if (kabari) await kabariAnggotaBaru(db, d.id, baru, { baseUrl: kabari.baseUrl, oleh: oleh.nama });
  return d.id as string;
}

export const RIWAYAT_KOLOM = 'id,item_id,teks_item,aksi,nama,lewat,created_at';
