'use client';

import { supabase } from '@/lib/supabase';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariBast {
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

export async function cariBast(k: KonteksCariBast) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
    res } = k;
  if (bolehModul('form-bast')) try {
    let qf = supabase.from('form_reviews')
      .select('id, project_name, address, sales_name, sales_division, assign_name')
      .or(`project_name.ilike.%${q}%,address.ilike.%${q}%,sales_name.ilike.%${q}%,assign_name.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(10);
    if (!tanpaBatas) qf = batasiLingkup(lingkup, qf, ['sales_name']);
    const { data } = await qf;
    let reviews = (data ?? []);
    if (isSalesSup) {
      reviews = reviews.filter((r: any) =>
        salesDivisions.includes(r.sales_division) || salesSubNames.some(n => n === r.sales_name));
    }
    reviews.forEach((r) => res.push({
      id: `review-${r.id}`, type: 'review', icon: '⭐',
      title: r.project_name ?? '-',
      sub: r.address ?? '-',
      meta: r.sales_name ?? '-',
      url: '/form-review',
    }));
  } catch (e) { console.error('[search] form review:', e); }
}
