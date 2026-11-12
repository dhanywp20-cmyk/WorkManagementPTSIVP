'use client';

import { supabase } from '@/lib/supabase';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariProgress {
  bolehModul: (kunci: string) => boolean;
  q: string;
  tanpaBatas: boolean;
  batasiLingkup: <T>(lingkup: LingkupProject, query: T, kolomMilik: string[], kolomDivisi?: string) => T;
  lingkup: LingkupProject;
  res: SearchResult[];
}

export async function cariProgress(k: KonteksCariProgress) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, res } = k;
  if (bolehModul('project-progress')) try {
    let qpp = supabase.from('checklist_proyek')
      .select('id, nama, client, status, sales_name')
      .or(`nama.ilike.%${q}%,client.ilike.%${q}%,sales_name.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(10);
    if (!tanpaBatas) qpp = batasiLingkup(lingkup, qpp, ['sales_name']);
    const { data } = await qpp;
    (data ?? []).forEach((p: any) => res.push({
      id: `progress-${p.id}`, type: 'progress', icon: '📊',
      title: p.nama ?? '-',
      sub: p.client ?? 'Tanpa client',
      meta: p.sales_name ?? '-',
      badge: p.status,
      badgeColor: p.status === 'done' ? '#10b981' : p.status === 'blocked' ? '#f43f5e' : '#f59e0b',
      url: '/project-progress',
    }));
  } catch (e) { console.error('[search] project progress:', e); }
}
