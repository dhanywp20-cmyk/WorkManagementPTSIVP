import { PIE_COLORS } from './shared';

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

function jadiPie(map: Record<string, number>, urut: boolean): IrisPie[] {
  let baris = Object.entries(map);
  if (urut) baris = baris.sort((a, b) => b[1] - a[1]);
  return baris.map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
}
function hitung<T>(daftar: T[], kunci: (r: T) => string | null | undefined, semua = false): Record<string, number> {
  const map: Record<string, number> = {};
  daftar.forEach(r => { const k = kunci(r); if (semua || k) map[k as string] = (map[k as string] || 0) + 1; });
  return map;
}

export const pieKategori = (d: { category: string }[]) => jadiPie(hitung(d, r => r.category, true), false);
export const pieDivisiSales = (d: { sales_division?: string | null }[]) => jadiPie(hitung(d, r => r.sales_division), true);
export const pieTeamPts = (d: { assign_name?: string | null }[]) => jadiPie(hitung(d, r => r.assign_name), true);
export const pieProduk = (d: { product?: string | null }[]) => jadiPie(hitung(d, r => r.product), true);
