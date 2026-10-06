/**
 * Hitungan murni Reminder Schedule (dipisah dari page.tsx): pengelompokan baris daftar dan
 * data pie chart. Tanpa React / jaringan - diuji di uji/olah-reminder.ts.
 */
import { PIE_COLORS } from './shared';

/**
 * Reminder sekejadian digabung jadi satu baris tampilan:
 *  - batch_id sama (satu pengajuan multi-tanggal) selalu digabung, berapa pun tanggalnya;
 *  - selain itu, kelompok per project / kategori / tanggal / jam (bulk-assign 1 hari).
 * Urutan kelompok = urutan kemunculan pertama.
 */
export function kelompokkanReminder<T extends { batch_id?: string | null; project_name?: string | null; title?: string | null; category?: string | null; due_date: string; due_time?: string | null }>(daftar: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const r of daftar) {
    const key = r.batch_id ? `batch:${r.batch_id}` : `${(r.project_name || r.title || '').trim()}|${r.category}|${r.due_date}|${r.due_time || ''}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.values());
}

export interface IrisPie { label: string; value: number; color: string }

function jadiPie(map: Record<string, number>, urut: boolean, batas?: number): IrisPie[] {
  let baris = Object.entries(map);
  if (urut) baris = baris.sort((a, b) => b[1] - a[1]);
  if (batas) baris = baris.slice(0, batas);
  return baris.map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
}
/** Hitung per kunci; `semua` = nilai kosong ikut dihitung (kategori), selain itu dilewati. */
function hitung<T>(daftar: T[], kunci: (r: T) => string | null | undefined, semua = false): Record<string, number> {
  const map: Record<string, number> = {};
  daftar.forEach(r => { const k = kunci(r); if (semua || k) map[k as string] = (map[k as string] || 0) + 1; });
  return map;
}

/** Per kategori (urutan kemunculan). */
export const pieKategori = (d: { category: string }[]) => jadiPie(hitung(d, r => r.category, true), false);
/** Per divisi sales, 8 terbanyak. */
export const pieDivisiSales = (d: { sales_division?: string | null }[]) => jadiPie(hitung(d, r => r.sales_division), true, 8);
/** Per anggota Team PTS yang ditugaskan, semua. */
export const pieTeamPts = (d: { assign_name?: string | null }[]) => jadiPie(hitung(d, r => r.assign_name), true);
/** Per produk, 12 terbanyak. */
export const pieProduk = (d: { product?: string | null }[]) => jadiPie(hitung(d, r => r.product), true, 12);
