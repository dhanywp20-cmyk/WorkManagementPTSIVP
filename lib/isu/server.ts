import { getAdminClient } from '../supabase-admin';
import { akunAdmin, akunBacaSemua, akunLihatSemua, tokenSah, type Akun, type Db } from '../checklist/server';
import {
  KATEGORI_BAWAAN, STATUS_ISU, PRIORITAS_ISU, tanggalWib, tebakKategori,
  type HakIsu, type Isu, type IsuGrup, type LokasiIsu, type PrioritasIsu, type RiwayatIsu, type StatusIsu, type TiketIsu,
} from './inti';

export const KOLOM_GRUP = 'id,nama,client,keterangan,proyek_ids,kategori,share_aktif,share_token,updated_at';
const KOLOM_GRUP_PUBLIK = 'id,nama,client,keterangan,proyek_ids,kategori,share_aktif,updated_at';
const KOLOM_ISU_PUBLIK = 'id,grup_id,nomor,daftar_id,lokasi,tanggal,kategori,prioritas,judul,deskripsi,produk,pelapor,pic,status,action,solusi,foto_url,foto_thumb_url,selesai_pada,dibuat_oleh_nama,diubah_oleh_nama,created_at,updated_at';
export const KOLOM_ISU = `${KOLOM_ISU_PUBLIK},catatan_internal`;
export const KOLOM_RIWAYAT = 'id,isu_id,aksi,dari,ke,keterangan,nama,created_at';

export function akunManager(a: Akun): boolean {
  return a.role.toLowerCase() === 'team' && (a.jabatan ?? '').trim().toLowerCase() === 'manager';
}

export function hakIsu(a: Akun): HakIsu & { lihat: boolean } {
  return { lihat: akunBacaSemua(a), edit: akunLihatSemua(a), admin: akunAdmin(a), kelola: akunAdmin(a) || akunManager(a) };
}

async function semuaBaris<T>(buat: (dari: number, sampai: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const hasil: T[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999);
    if (error) throw new Error(error.message);
    const baris = (data ?? []) as T[];
    hasil.push(...baris);
    if (baris.length < 1000) return hasil;
  }
}

export async function muatLokasi(db: Db, proyekIds: string[]): Promise<LokasiIsu[]> {
  if (!proyekIds.length) return [];
  const [{ data: proyek }, { data: daftar, error }] = await Promise.all([
    db.from('checklist_proyek').select('id,nama,created_at').in('id', proyekIds),
    db.from('checklist_daftar').select('id,proyek_id,judul,urutan').in('proyek_id', proyekIds).order('urutan').order('created_at'),
  ]);
  if (error) throw new Error(error.message);
  const urutProyek = new Map(((proyek ?? []) as { id: string; nama: string; created_at: string }[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p, i) => [p.id, { nama: p.nama, i }]));
  return ((daftar ?? []) as { id: string; proyek_id: string; judul: string; urutan: number }[])
    .sort((a, b) => (urutProyek.get(a.proyek_id)?.i ?? 0) - (urutProyek.get(b.proyek_id)?.i ?? 0) || a.urutan - b.urutan)
    .map(d => ({ id: d.id, nama: d.judul.trim(), proyek: urutProyek.get(d.proyek_id)?.nama ?? '' }));
}

export async function muatIsu(db: Db, grupId: string, publik: boolean): Promise<Isu[]> {
  return semuaBaris<Isu>((a, b) => db.from('isu_log').select(publik ? KOLOM_ISU_PUBLIK : KOLOM_ISU)
    .eq('grup_id', grupId).order('nomor', { ascending: false }).range(a, b));
}

export async function muatGrup(db: Db, grupId: string): Promise<IsuGrup | null> {
  const { data } = await db.from('isu_grup').select(KOLOM_GRUP).eq('id', grupId).maybeSingle();
  return (data as IsuGrup | null) ?? null;
}

export async function cariGrupShare(token: string): Promise<{ db: Db; grup: IsuGrup } | null> {
  if (!tokenSah(token)) return null;
  const db = getAdminClient();
  const { data } = await db.from('isu_grup').select(KOLOM_GRUP_PUBLIK).eq('share_token', token).maybeSingle();
  const grup = data as IsuGrup | null;
  if (!grup || !grup.share_aktif) return null;
  return { db, grup };
}

const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.trim().slice(0, maks) : '');

export function isianGrup(b: Record<string, unknown>):
  { galat: string } | { isian: Pick<IsuGrup, 'nama' | 'client' | 'keterangan' | 'proyek_ids' | 'kategori'> } {
  const nama = teks(b.nama, 120);
  if (!nama) return { galat: 'Nama grup wajib diisi.' };
  const proyek_ids = Array.isArray(b.proyek_ids)
    ? [...new Set(b.proyek_ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))]
    : [];
  if (!proyek_ids.length) return { galat: 'Pilih minimal satu proyek sebagai sumber lokasi.' };
  const kategori = Array.isArray(b.kategori)
    ? [...new Set(b.kategori.map(k => teks(k, 40)).filter(Boolean))].slice(0, 30)
    : [];
  return {
    isian: {
      nama, client: teks(b.client, 120) || null, keterangan: teks(b.keterangan, 1000), proyek_ids,
      kategori: kategori.length ? kategori : KATEGORI_BAWAAN,
    },
  };
}

export interface IsianIsu {
  daftar_id: string | null;
  lokasi: string;
  tanggal: string;
  kategori: string;
  produk: string;
  prioritas: PrioritasIsu;
  judul: string;
  deskripsi: string;
  pelapor: string;
  pic: string;
  status: StatusIsu;
  action: string;
  solusi: string;
  catatan_internal: string;
}

const LABEL_KOLOM: Partial<Record<keyof IsianIsu, string>> = {
  lokasi: 'lokasi', tanggal: 'tanggal', kategori: 'kategori', produk: 'produk', prioritas: 'prioritas', judul: 'judul', deskripsi: 'deskripsi',
  pelapor: 'pelapor', pic: 'PIC', solusi: 'solusi',
};
export function isianIsu(b: Record<string, unknown>, lokasi: LokasiIsu[], sebagian: boolean):
  { galat: string } | { isian: Partial<IsianIsu> } {
  const isian: Partial<IsianIsu> = {};
  const ada = (k: string) => !sebagian || k in b;

  if (ada('daftar_id') || ada('lokasi')) {
    const id = typeof b.daftar_id === 'string' ? b.daftar_id : '';
    const l = lokasi.find(x => x.id === id);
    if (l) { isian.daftar_id = l.id; isian.lokasi = l.nama; }
    else {
      const bebas = teks(b.lokasi, 120);
      if (!bebas) return { galat: 'Pilih lokasi isu.' };
      isian.daftar_id = null; isian.lokasi = bebas;
    }
  }
  if (ada('tanggal')) {
    const t = teks(b.tanggal, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) return { galat: 'Tanggal tidak valid.' };
    if (t > tanggalWib(new Date())) return { galat: 'Tanggal isu tidak boleh di masa depan.' };
    isian.tanggal = t;
  }
  if (ada('judul')) {
    const j = teks(b.judul, 200);
    if (!j) return { galat: 'Judul isu wajib diisi.' };
    isian.judul = j;
  }
  if (ada('kategori')) isian.kategori = teks(b.kategori, 40) || 'Lainnya';
  if (ada('produk')) isian.produk = teks(b.produk, 120);
  if (ada('prioritas')) {
    const p = String(b.prioritas ?? 'sedang') as PrioritasIsu;
    if (!(p in PRIORITAS_ISU)) return { galat: 'Prioritas tidak dikenal.' };
    isian.prioritas = p;
  }
  if (ada('status')) {
    const s = String(b.status ?? 'open') as StatusIsu;
    if (!(s in STATUS_ISU)) return { galat: 'Status tidak dikenal.' };
    isian.status = s;
  }
  for (const k of ['deskripsi', 'pelapor', 'pic', 'action', 'solusi', 'catatan_internal'] as const) {
    if (ada(k)) isian[k] = teks(b[k], k === 'deskripsi' || k === 'catatan_internal' ? 3000 : k === 'pelapor' || k === 'pic' ? 120 : 1500);
  }
  return { isian };
}
export function kolomBerubah(lama: Isu, baru: Partial<IsianIsu>): string[] {
  return (Object.keys(LABEL_KOLOM) as (keyof IsianIsu)[])
    .filter(k => k in baru && (baru[k] ?? '') !== ((lama as unknown as Record<string, unknown>)[k] ?? ''))
    .map(k => LABEL_KOLOM[k] as string);
}

export async function nomorBerikut(db: Db, grupId: string): Promise<number> {
  const { data } = await db.from('isu_log').select('nomor').eq('grup_id', grupId).order('nomor', { ascending: false }).limit(1).maybeSingle();
  return ((data as { nomor: number } | null)?.nomor ?? 0) + 1;
}

export async function catatRiwayat(db: Db, baris: { isu_id: string; aksi: string; dari?: string | null; ke?: string | null; keterangan?: string; nama: string }[]) {
  if (!baris.length) return;
  await db.from('isu_riwayat').insert(baris.map(b => ({ dari: null, ke: null, keterangan: '', ...b })));
}

export async function sentuhGrup(db: Db, grupId: string) {
  await db.from('isu_grup').update({ updated_at: new Date().toISOString() }).eq('id', grupId);
}

interface BarisTiket {
  id: string; project_name: string | null; issue_case: string | null; description: string | null; assign_name: string | null;
  status: string | null; date: string | null; created_at: string; updated_at: string | null; created_by: string | null;
  sales_name: string | null; product: string | null; priority: string | null; photo_url: string | null;
  reminder_id: string | null; is_deleted: boolean | null; address: string | null; customer_phone: string | null;
  sn_unit: string | null; current_team: string | null; services_status: string | null; sales_division: string | null;
  photo_name: string | null; rejection_reason: string | null; routing_status: string | null; brand: string | null;
}
interface BarisAktivitas {
  id: string; ticket_id: string; handler_name: string | null; handler_username: string | null; action_taken: string | null;
  notes: string | null; file_url: string | null; file_name: string | null; photo_url: string | null; photo_name: string | null;
  new_status: string | null; team_type: string | null; assigned_to_services: boolean | null; created_at: string;
}

const KOLOM_TIKET = [
  'id,project_name,issue_case,description,assign_name,status,date,created_at,updated_at,created_by,sales_name,product,priority',
  'photo_url,reminder_id,is_deleted,address,customer_phone,sn_unit,current_team,services_status,sales_division,photo_name',
  'rejection_reason,routing_status,brand',
].join(',');
const KOLOM_AKTIVITAS = 'id,ticket_id,handler_name,handler_username,action_taken,notes,file_url,file_name,photo_url,photo_name,new_status,team_type,assigned_to_services,created_at';

export function normalNama(s: string, buang: string[]): string {
  const kata = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return kata.filter(k => !buang.includes(k)).join(' ');
}

function utc(t: string): string {
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`;
}

function prioritasTiket(p: string | null): PrioritasIsu {
  const x = (p ?? '').toLowerCase();
  if (/high|urgent|tinggi|critical/.test(x)) return 'tinggi';
  if (/low|rendah/.test(x)) return 'rendah';
  return 'sedang';
}

export function statusTiket(status: string | null, adaAktivitas: boolean): StatusIsu {
  const s = (status ?? '').toLowerCase();
  if (s === 'solved') return 'solved';
  if (s === 'pending' && !adaAktivitas) return 'open';
  if (/waiting|menunggu/.test(s)) return 'pending';
  return 'progress';
}

function dataTiket(t: BarisTiket, akt: BarisAktivitas[], publik: boolean): TiketIsu {
  const { is_deleted: _hapus, updated_at: _ubah, ...sisa } = t;
  void _hapus; void _ubah;
  return {
    ...sisa,
    customer_phone: publik ? null : t.customer_phone,
    created_by: publik ? null : t.created_by,
    activity_logs: akt.map(a => ({ ...a, handler_username: publik ? null : a.handler_username })),
  };
}

export async function muatIsuTiket(db: Db, grup: IsuGrup, publik: boolean): Promise<Isu[]> {
  if (!grup.proyek_ids.length) return [];
  const { data: daftar, error } = await db.from('checklist_daftar').select('id,judul,source_reminder_id').in('proyek_id', grup.proyek_ids);
  if (error) throw new Error(error.message);
  const lokasi = (daftar ?? []) as { id: string; judul: string; source_reminder_id: string | null }[];
  if (!lokasi.length) return [];

  const buang = normalNama(grup.client ?? '', []).split(' ').filter(Boolean);
  const perNama = new Map(lokasi.map(l => [normalNama(l.judul, buang), l]));
  const perReminder = new Map(lokasi.filter(l => l.source_reminder_id).map(l => [l.source_reminder_id as string, l]));

  const klien = (grup.client ?? '').trim().replace(/[%,()]/g, '');
  const [byNama, byReminder] = await Promise.all([
    klien
      ? db.from('tickets').select(KOLOM_TIKET).ilike('project_name', `%${klien}%`).limit(2000)
      : db.from('tickets').select(KOLOM_TIKET).in('project_name', lokasi.map(l => l.judul)).limit(2000),
    perReminder.size
      ? db.from('tickets').select(KOLOM_TIKET).in('reminder_id', [...perReminder.keys()]).limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (byNama.error) throw new Error(byNama.error.message);
  const semua = new Map<string, BarisTiket>();
  for (const t of [...((byNama.data ?? []) as unknown as BarisTiket[]), ...((byReminder.data ?? []) as unknown as BarisTiket[])]) semua.set(t.id, t);

  const cocok: { t: BarisTiket; l: (typeof lokasi)[number] }[] = [];
  for (const t of semua.values()) {
    if (t.is_deleted) continue;
    const l = (t.reminder_id && perReminder.get(t.reminder_id)) || perNama.get(normalNama(t.project_name ?? '', buang));
    if (l) cocok.push({ t, l });
  }
  if (!cocok.length) return [];

  const aktivitas = new Map<string, BarisAktivitas[]>();
  const ids = cocok.map(c => c.t.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: akt } = await db.from('activity_logs').select(KOLOM_AKTIVITAS)
      .in('ticket_id', ids.slice(i, i + 150)).order('created_at');
    for (const a of (akt ?? []) as BarisAktivitas[]) aktivitas.set(a.ticket_id, [...(aktivitas.get(a.ticket_id) ?? []), a]);
  }

  return cocok.map(({ t, l }) => {
    const akt = aktivitas.get(t.id) ?? [];
    const status = statusTiket(t.status, akt.length > 0);
    const terakhir = [...akt].reverse().find(a => (a.action_taken ?? '').trim());
    const selesaiAkt = [...akt].reverse().find(a => (a.new_status ?? '').toLowerCase() === 'solved');
    const dibuat = utc(t.created_at);
    const selesai_pada = status === 'solved' ? (selesaiAkt?.created_at ?? (t.updated_at ? utc(t.updated_at) : dibuat)) : null;
    const riwayat: RiwayatIsu[] = [
      { id: `${t.id}-buat`, isu_id: t.id, aksi: 'dibuat', dari: null, ke: 'open', keterangan: 'Ticket Troubleshooting dibuat', nama: t.created_by, created_at: dibuat },
      ...akt.map(a => {
        const ke = a.new_status ? statusTiket(a.new_status, true) : null;
        return {
          id: a.id, isu_id: t.id, aksi: ke ? 'status' : 'action', dari: null, ke,
          keterangan: (a.action_taken ?? '').trim(), nama: a.handler_name, created_at: a.created_at,
        };
      }),
    ];
    return {
      id: t.id, grup_id: grup.id, nomor: 0, daftar_id: l.id, lokasi: l.judul.trim(),
      tanggal: t.date ?? tanggalWib(dibuat), kategori: tebakKategori([t.issue_case, t.product, t.description].join(' ')),
      produk: (t.product ?? '').trim(), prioritas: prioritasTiket(t.priority),
      judul: (t.issue_case ?? '').trim() || 'Ticket Troubleshooting', deskripsi: (t.description ?? '').trim(),
      pelapor: t.sales_name ?? '', pic: t.assign_name ?? '', status,
      action: status === 'solved' ? '' : (terakhir?.action_taken ?? '').trim(),
      solusi: status === 'solved' ? ((selesaiAkt?.action_taken || terakhir?.action_taken) ?? '').trim() : '',
      foto_url: t.photo_url, foto_thumb_url: t.photo_url, selesai_pada,
      dibuat_oleh_nama: t.created_by, diubah_oleh_nama: terakhir?.handler_name ?? null,
      created_at: dibuat, updated_at: t.updated_at ? utc(t.updated_at) : dibuat,
      sumber: 'tiket' as const, tiket_id: t.id, riwayat, tiket: dataTiket(t, akt, publik),
    };
  });
}

export async function muatSemuaIsu(db: Db, grup: IsuGrup, publik: boolean): Promise<Isu[]> {
  const [manual, tiket] = await Promise.all([muatIsu(db, grup.id, publik), muatIsuTiket(db, grup, publik)]);
  return [...manual.map(i => ({ ...i, sumber: 'manual' as const })), ...tiket];
}
