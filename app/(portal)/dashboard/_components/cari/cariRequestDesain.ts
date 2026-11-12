'use client';

import { supabase } from '@/lib/supabase';
import { User } from '../shared';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariRequestDesain {
  bolehModul: (kunci: string) => boolean;
  q: string;
  tanpaBatas: boolean;
  batasiLingkup: <T>(lingkup: LingkupProject, query: T, kolomMilik: string[], kolomDivisi?: string) => T;
  lingkup: LingkupProject;
  isSalesSup: boolean;
  salesSubNames: string[];
  salesDivisions: string[];
  currentUser: User;
  isAdmin: boolean;
  res: SearchResult[];
}

export async function cariRequestDesain(k: KonteksCariRequestDesain) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesSubNames, salesDivisions,
    currentUser, isAdmin, res } = k;
  if (bolehModul('request-design-project')) try {
    let qp = supabase.from('project_requests')
      .select('id, project_name, status, sales_name, sales_division, created_at, requester_id')
      .or(`project_name.ilike.%${q}%,sales_name.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(15);
    if (!tanpaBatas) qp = batasiLingkup(lingkup, qp, ['sales_name']);
    const { data: pData } = await qp;
    let projects = (pData ?? []) as any[];

    if (isSalesSup) {
      const allSubIdsRes = salesSubNames.length
        ? await supabase.from('users').select('id').in('full_name', salesSubNames)
        : { data: [] };
      const subIds = (allSubIdsRes.data ?? []).map((u) => u.id as string);
      projects = projects.filter((p: any) =>
        salesDivisions.includes(p.sales_division) || subIds.includes(p.requester_id)
      );
    } else if (currentUser.role?.toLowerCase() === 'team' && !isAdmin) {
      projects = [];
    }

    projects.forEach((p: any) => res.push({
      id: `proj-${p.id}`, type: 'project', icon: '🏗️',
      title: p.project_name ?? '-',
      sub: p.sales_name ?? '-',
      meta: p.status ?? '-',
      badge: p.status,
      badgeColor: p.status === 'Done' ? '#10b981' : p.status === 'Pending' ? '#f59e0b' : '#3b82f6',
      url: '/form-require-project',
    }));
  } catch (e) { console.error('[search] projects:', e); }
}
