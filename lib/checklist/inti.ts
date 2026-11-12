
import { appBaseUrl } from '../app-url';

export interface DraftItem {
  kelompok: string;
  teks: string;
  catatan: string;
  selesai: boolean;
}

export interface DraftBagian {
  judul: string;
  catatan: string;
  items: DraftItem[];
}

export interface DraftChecklist {
  judul: string;
  keterangan: string;
  bagian: DraftBagian[];
}

export type SumberChecklist = 'teks' | 'excel' | 'duplikat' | 'kosong' | 'reminder' | 'migrasi';
export type LewatCentang = 'admin' | 'link';
export type StatusProyek = 'in_progress' | 'done' | 'blocked';
export type AsalData = 'manual' | 'auto_reminder' | 'migrasi';

export const STATUS_PROYEK: Record<StatusProyek, { label: string; warna: string; tint: string }> = {
  in_progress: { label: 'Berjalan', warna: '#1d4ed8', tint: '#eff6ff' },
  done: { label: 'Selesai', warna: '#15803d', tint: '#f0fdf4' },
  blocked: { label: 'Tertahan', warna: '#b91c1c', tint: '#fef2f2' },
};

export interface ChecklistProyek {
  id: string;
  nama: string;
  client: string | null;
  deskripsi: string;
  sales_name: string | null;
  sales_division: string | null;
  status: StatusProyek;
  start_date: string | null;
  target_date: string | null;
  origin: AsalData;
  share_aktif: boolean;
  share_token?: string | null;
  dibuat_oleh_nama: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistAnggota {
  daftar_id: string;
  user_id: string;
  nama: string;
}

export interface ChecklistDaftar {
  id: string;
  proyek_id: string;
  judul: string;
  keterangan: string;
  support_lokasi?: string;
  sumber: SumberChecklist;
  share_aktif: boolean;
  share_token?: string | null;
  start_date: string | null;
  target_date: string | null;
  urutan: number;
  origin: AsalData;
  dibuat_oleh_nama: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistBagian {
  id: string;
  daftar_id: string;
  judul: string;
  catatan: string;
  urutan: number;
}

export interface ChecklistItem {
  id: string;
  daftar_id: string;
  bagian_id: string;
  kelompok: string;
  teks: string;
  catatan: string;
  urutan: number;
  selesai: boolean;
  selesai_oleh: string | null;
  selesai_pada: string | null;
  selesai_lewat: LewatCentang | null;
  kendala: boolean;
  kendala_catatan: string;
  kendala_oleh: string | null;
  kendala_pada: string | null;
  foto_url: string | null;
  foto_thumb_url: string | null;
  tertunda?: boolean;
}

export type AksiRiwayat = 'centang' | 'batal' | 'kendala' | 'kendala_selesai';

export interface ChecklistRiwayat {
  id: number;
  item_id: string | null;
  teks_item: string;
  aksi: AksiRiwayat;
  nama: string;
  lewat: LewatCentang;
  created_at: string;
}

export interface HakChecklist {
  admin: boolean;
  edit: boolean;
}

export interface ChecklistDetail {
  proyek: Pick<ChecklistProyek, 'id' | 'nama' | 'client' | 'sales_name' | 'sales_division' | 'status'>;
  daftar: ChecklistDaftar;
  anggota: ChecklistAnggota[];
  bagian: ChecklistBagian[];
  items: ChecklistItem[];
  riwayat?: ChecklistRiwayat[];
  hak?: HakChecklist;
}

export interface StatChecklist {
  total: number;
  selesai: number;
  kendala: number;
}

export interface ChecklistRingkas extends ChecklistDaftar {
  anggota: ChecklistAnggota[];
  stat: StatChecklist;
  saya: boolean;
}

export interface StatLokasi { selesai: number; berjalan: number; belum: number; kosong: number }

export function statusLokasiDari(st: StatChecklist): keyof StatLokasi {
  if (st.total === 0) return 'kosong';
  if (st.selesai === st.total) return 'selesai';
  return st.selesai > 0 ? 'berjalan' : 'belum';
}

export interface ProyekRingkas extends ChecklistProyek {
  jumlah_checklist: number;
  stat: StatChecklist;
  lokasi: StatLokasi;
  target_terdekat: string | null;
  saya: boolean;
}

export interface ProyekDetail {
  proyek: ChecklistProyek;
  checklist: ChecklistRingkas[];
  aktivitas?: { kontribusi: { nama: string; jumlah: number }[]; perHari: Record<string, number> };
  admin: boolean;
}

export const BATAS = {
  bagian: 100,
  item: 1500,
  judul: 200,
  teks: 1000,
  catatan: 5000,
  keterangan: 5000,
  nama: 60,
  support: 200,
  perubahan: 500,
} as const;

export interface PerubahanItem {
  itemId: string;
  selesai?: boolean;
  kendala?: boolean;
  catatan?: string;
  waktu?: string;
}

export function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function selisihHari(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export type KeadaanJadwal = 'selesai' | 'terlambat' | 'dekat' | 'aman' | 'tanpa';

export function keadaanJadwal(target: string | null, tuntas: boolean, hari = hariIni()): { keadaan: KeadaanJadwal; label: string } {
  if (tuntas) return { keadaan: 'selesai', label: 'Selesai' };
  if (!target) return { keadaan: 'tanpa', label: 'Tanpa target' };
  const n = selisihHari(hari, target.slice(0, 10));
  if (n < 0) return { keadaan: 'terlambat', label: `Terlambat ${-n} hari` };
  if (n === 0) return { keadaan: 'dekat', label: 'Target hari ini' };
  if (n <= 3) return { keadaan: 'dekat', label: `Target ${n} hari lagi` };
  return { keadaan: 'aman', label: `Target ${n} hari lagi` };
}

export function formatTanggal(t: string | null | undefined): string {
  if (!t) return '-';
  const d = new Date(t.length === 10 ? `${t}T00:00:00` : t);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function statDari(items: { selesai: boolean; kendala: boolean }[]): StatChecklist {
  return {
    total: items.length,
    selesai: items.filter(i => i.selesai).length,
    kendala: items.filter(i => i.kendala && !i.selesai).length,
  };
}

export interface Progres { selesai: number; total: number; persen: number }

export function hitungProgres(items: { selesai: boolean }[]): Progres {
  const total = items.length;
  const selesai = items.filter(i => i.selesai).length;
  return { selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0 };
}

export function progresDari(selesai: number, total: number): Progres {
  return { selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0 };
}

export function validasiNama(v: unknown): string | null {
  const nama = sel(v).replace(/\s+/g, ' ');
  if (nama.length < 2 || nama.length > BATAS.nama) return null;
  return nama;
}

export function urlShareChecklist(token: string): string {
  return `${appBaseUrl()}/checklist/share/${token}`;
}

export function formatWaktu(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function kelompokkan<T extends { kelompok: string }>(items: T[]): { kelompok: string; items: T[] }[] {
  const hasil: { kelompok: string; items: T[] }[] = [];
  for (const it of items) {
    const ada = hasil.find(h => h.kelompok === it.kelompok);
    if (ada) ada.items.push(it);
    else hasil.push({ kelompok: it.kelompok, items: [it] });
  }
  return hasil;
}

export function sel(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r/g, '').trim();
}
