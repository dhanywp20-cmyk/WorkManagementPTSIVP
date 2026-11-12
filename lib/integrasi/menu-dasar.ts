import { type LingkupProject } from '@/lib/project-scope';
import { adalahPTS, type AkunTambahan, type HasilAksi, type KonteksAksi } from '@/lib/integrasi/bantu';

export type Baris = Record<string, unknown>;
export type Aksi = (a: Record<string, unknown>, k: KonteksAksi) => Promise<HasilAksi>;
export const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

export async function lingkupServer(k: KonteksAksi, t: AkunTambahan): Promise<LingkupProject> {
  if (adalahPTS(k.u)) return { semua: true, divisi: [], namaSendiri: k.u.full_name ?? '' };
  const divisi = new Set<string>();
  if (t.is_internal_sales) {
    const { data } = await k.db.from('division_ivp_mappings').select('sales_division').eq('ivp_id', k.u.id);
    for (const m of (data ?? []) as { sales_division: string }[]) if (m.sales_division) divisi.add(m.sales_division);
    if (k.u.sales_division) divisi.add(k.u.sales_division);
  }
  return { semua: false, divisi: Array.from(divisi), namaSendiri: k.u.full_name ?? '' };
}
