import { getAdminClient } from '../supabase-admin';
import { akunAdmin, akunBacaSemua, akunLihatSemua, tokenSah, type Akun, type Db } from '../checklist/server';
import {
  KATEGORI_BAWAAN, STATUS_ISU, PRIORITAS_ISU, tanggalWib,
  type HakIsu, type Isu, type IsuGrup, type LokasiIsu, type PrioritasIsu, type StatusIsu,
} from './inti';

export const KOLOM_GRUP = 'id,nama,client,keterangan,proyek_ids,kategori,share_aktif,share_token,updated_at';
const KOLOM_GRUP_PUBLIK = 'id,nama,client,keterangan,proyek_ids,kategori,share_aktif,updated_at';
const KOLOM_ISU_PUBLIK = 'id,grup_id,nomor,daftar_id,lokasi,tanggal,kategori,prioritas,judul,deskripsi,pelapor,pic,status,action,solusi,foto_url,foto_thumb_url,selesai_pada,dibuat_oleh_nama,diubah_oleh_nama,created_at,updated_at';
export const KOLOM_ISU = `${KOLOM_ISU_PUBLIK},catatan_internal`;
export const KOLOM_RIWAYAT = 'id,isu_id,aksi,dari,ke,keterangan,nama,created_at';

export function hakIsu(a: Akun): HakIsu & { lihat: boolean } {
  return { lihat: akunBacaSemua(a), edit: akunLihatSemua(a), admin: akunAdmin(a) };
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
  lokasi: 'lokasi', tanggal: 'tanggal', kategori: 'kategori', prioritas: 'prioritas', judul: 'judul', deskripsi: 'deskripsi',
  pelapor: 'pelapor', pic: 'PIC', solusi: 'solusi',
};

/** Validasi isian isu. `sebagian` = PATCH: hanya kolom yang dikirim yang diperiksa. */
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

/** Daftar kolom publik yang berubah, untuk dicatat di riwayat (catatan internal tidak disebut). */
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
