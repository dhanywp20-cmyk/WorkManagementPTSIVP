import { supabase } from '@/lib/supabase';

export type Brand = 'MVI' | 'IVP' | 'BOTH';

export const BRAND_OPTIONS: { value: Brand; label: string; short: string }[] = [
  { value: 'MVI', label: 'MVI (House Brand)', short: 'MVI' },
  { value: 'IVP', label: 'IVP (Global Brand)', short: 'IVP' },
  { value: 'BOTH', label: 'Kedua Brand', short: 'MVI + IVP' },
];
export const BRAND_LABEL: Record<string, string> = {
  MVI: 'MVI (House Brand)', IVP: 'IVP (Global Brand)', BOTH: 'Kedua Brand',
};

export interface BrandInternal { id: string; full_name: string; phone_number: string | null; }
export interface BrandResolution {
  mvi: BrandInternal | null;
  ivp: BrandInternal | null;
  missing: string[];
}

export async function resolveBrandInternals(salesDivision: string, brand: Brand): Promise<BrandResolution> {
  const res: BrandResolution = { mvi: null, ivp: null, missing: [] };
  if (!salesDivision) return res;
  const { data: maps } = await supabase.from('division_ivp_mappings')
    .select('ivp_id, brand_type').eq('sales_division', salesDivision);
  const rows = (maps ?? []) as { ivp_id: string; brand_type: string | null }[];
  const ids = Array.from(new Set(rows.map(m => m.ivp_id)));
  const usersById: Record<string, BrandInternal> = {};
  if (ids.length) {
    const { data: us } = await supabase.from('users').select('id, full_name, phone_number').in('id', ids);
    (us ?? []).forEach((u) => { usersById[u.id] = { id: u.id, full_name: u.full_name, phone_number: u.phone_number ?? null }; });
  }
  const pick = (bt: 'MVI' | 'IVP'): BrandInternal | null => {
    const exact = rows.find(m => m.brand_type === bt);
    const legacy = rows.find(m => !m.brand_type);
    const row = exact ?? legacy;
    return row ? (usersById[row.ivp_id] ?? null) : null;
  };
  if (brand === 'MVI' || brand === 'BOTH') { res.mvi = pick('MVI'); if (!res.mvi) res.missing.push('MVI (House Brand)'); }
  if (brand === 'IVP' || brand === 'BOTH') { res.ivp = pick('IVP'); if (!res.ivp) res.missing.push('IVP (Global Brand)'); }
  return res;
}
