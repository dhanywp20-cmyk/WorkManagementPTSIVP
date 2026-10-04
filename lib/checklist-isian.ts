/**
 * lib/checklist-isian.ts - pembersih isian dari body permintaan, dipakai
 * route server Project Progress. Murni (tanpa supabase).
 */

import { BATAS, type StatusProyek } from './checklist';

export function teks(v: unknown, batas: number): string {
  return String(v ?? '').replace(/\r/g, '').trim().slice(0, batas);
}

export function teksAtauNull(v: unknown, batas: number): string | null {
  const t = teks(v, batas);
  return t || null;
}

/** YYYY-MM-DD yang sah, atau null. */
export function tanggal(v: unknown): string | null {
  const t = String(v ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return Number.isNaN(new Date(`${t}T00:00:00`).getTime()) ? null : t;
}

export function statusProyek(v: unknown): StatusProyek {
  return v === 'done' || v === 'blocked' ? v : 'in_progress';
}

export function daftarId(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : [];
}

export interface IsianProyek {
  nama: string;
  client: string | null;
  deskripsi: string;
  sales_name: string | null;
  status: StatusProyek;
  start_date: string | null;
  target_date: string | null;
}

/**
 * Isian proyek dari form. Galat berupa kalimat yang bisa ditampilkan apa
 * adanya. Tipe hasilnya ditulis eksplisit: tanpa itu TypeScript melebur dua
 * cabang jadi satu bentuk berproperti opsional, dan `'galat' in hasil` tidak
 * lagi menyempitkan tipenya.
 */
export function isianProyek(b: Record<string, unknown>): { galat: string } | { isian: IsianProyek } {
  const nama = teks(b.nama, BATAS.judul);
  if (!nama) return { galat: 'Nama proyek wajib diisi.' };
  const start_date = tanggal(b.start_date);
  const target_date = tanggal(b.target_date);
  if (start_date && target_date && target_date < start_date) {
    return { galat: 'Tanggal target tidak boleh sebelum tanggal mulai.' };
  }
  return {
    isian: {
      nama,
      client: teksAtauNull(b.client, BATAS.judul),
      deskripsi: teks(b.deskripsi, BATAS.keterangan),
      sales_name: teksAtauNull(b.sales_name, BATAS.judul),
      status: statusProyek(b.status),
      start_date, target_date,
    },
  };
}
