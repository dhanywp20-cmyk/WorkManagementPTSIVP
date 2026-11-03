import { supabase } from './supabase';

export interface PenggunaLingkup {
  id: string;
  full_name: string;
  role?: string | null;
  team_type?: string | null;
  sales_division?: string | null;
  is_internal_sales?: boolean | null;
  access_level?: string | null;
}

export interface LingkupProject {
  semua: boolean;
  divisi: string[];
  namaSendiri: string;
}

function adalahPTS(u: PenggunaLingkup): boolean {
  const r = (u.role ?? '').toLowerCase();
  return ['admin', 'superadmin', 'team', 'team_pts'].includes(r);
}

const TANPA_LINGKUP = '__tanpa_lingkup__';

export async function hitungLingkupProject(u: PenggunaLingkup | null): Promise<LingkupProject> {
  if (!u) return { semua: false, divisi: [], namaSendiri: TANPA_LINGKUP };

  if (adalahPTS(u)) return { semua: true, divisi: [], namaSendiri: u.full_name };

  const divisi = new Set<string>();
  if (u.is_internal_sales) {
    const { data } = await supabase
      .from('division_ivp_mappings').select('sales_division').eq('ivp_id', u.id);
    for (const m of (data ?? []) as { sales_division: string }[]) {
      if (m.sales_division) divisi.add(m.sales_division);
    }
    if (u.sales_division) divisi.add(u.sales_division);
  }
  return { semua: false, divisi: Array.from(divisi), namaSendiri: u.full_name };
}

export function filterLingkup(
  l: LingkupProject,
  kolomNamaSales = 'sales_name',
  kolomDivisi = 'sales_division',
  opsi: {
    sertakanTanpaPemilik?: boolean;
  } = {},
): string | null {
  if (l.semua) return null;
  const aman = (v: string) => v.replace(/"/g, '');
  const bagian = [`${kolomNamaSales}.eq."${aman(l.namaSendiri)}"`];
  for (const d of l.divisi) bagian.push(`${kolomDivisi}.eq."${aman(d)}"`);
  if (opsi.sertakanTanpaPemilik) bagian.push(`${kolomNamaSales}.is.null`);
  return bagian.join(',');
}
