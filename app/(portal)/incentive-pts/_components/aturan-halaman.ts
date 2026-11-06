import type { IncentiveProjectRow } from './calc';
import { persenPicBerlaku, type SkemaInsentif } from './calc';
import { bisaKonfigPenuh, bisaInputNominal } from '@/lib/incentive/akses';

export interface CurrentUser { id?: string; username?: string; full_name?: string; role?: string; team_type?: string; incentive_akses?: string | null; allow_incentive_input?: boolean; incentive_brand_scope?: string | null; [k: string]: unknown; }

export { bolehLihatBrand } from '@/lib/incentive/nominal';

export function bisaKonfig(u: CurrentUser | null) { return bisaKonfigPenuh(u); }
export function bisaInput(u: CurrentUser | null) { return bisaInputNominal(u); }

export function calcHandlerSplit(sk: SkemaInsentif | null, p: IncentiveProjectRow): { pct: number; amt: number } | null {
  const pool = p.incentive_value || 0;
  if (!pool || !p.mode_penyelesaian || !sk) return null;
  const pct = persenPicBerlaku(
    sk, p.mode_penyelesaian === 'remote', true, p.pic_type === 'manager_pic',
  );
  return { pct, amt: Math.round((pool * pct) / 100) };
}

export type TabKey = 'projects' | 'tranches' | 'late' | 'skema' | 'settings';
