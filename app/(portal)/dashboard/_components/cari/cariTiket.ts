'use client';

import { supabase } from '@/lib/supabase';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariTiket {
  bolehModul: (kunci: string) => boolean;
  q: string;
  tanpaBatas: boolean;
  batasiLingkup: <T>(lingkup: LingkupProject, query: T, kolomMilik: string[], kolomDivisi?: string) => T;
  lingkup: LingkupProject;
  isSalesSup: boolean;
  salesDivisions: string[];
  salesSubNames: string[];
  res: SearchResult[];
}

export async function cariTiket(k: KonteksCariTiket) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
    res } = k;
  if (bolehModul('ticket-troubleshooting')) try {
    let q2 = supabase.from('tickets')
      .select('id, project_name, issue_case, assign_name, status, date, sales_division, sales_name, created_by')
      .or(`project_name.ilike.%${q}%,issue_case.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,sn_unit.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(20);

    if (!tanpaBatas) q2 = batasiLingkup(lingkup, q2, ['sales_name', 'created_by']);

    const { data: tData } = await q2;
    let tickets = (tData ?? []);

    if (tanpaBatas) {
    } else if (isSalesSup) {
      tickets = tickets.filter((t: any) =>
        salesDivisions.includes(t.sales_division) ||
        salesSubNames.some(n => n === t.sales_name || n === t.created_by)
      );
    }

    tickets.forEach((t: any) => res.push({
      id: `ticket-${t.id}`, type: 'ticket', icon: '🎫',
      title: t.project_name ?? '-',
      sub: t.issue_case ?? '-',
      meta: `${t.status} · ${t.assign_name ?? '-'}`,
      badge: t.status,
      badgeColor: t.status === 'Solved' ? '#10b981' : t.status === 'Waiting Approval' ? '#f59e0b' : '#3b82f6',
      url: '/ticketing',
    }));
  } catch (e) { console.error('[search] tickets:', e); }
}
