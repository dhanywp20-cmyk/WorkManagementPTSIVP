'use client';

import { supabase } from '@/lib/supabase';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariTechNote {
  bolehModul: (kunci: string) => boolean;
  tanpaBatas: boolean;
  q: string;
  res: SearchResult[];
}

export async function cariTechNote(k: KonteksCariTechNote) {
  const { bolehModul, tanpaBatas, q, res } = k;
  if (bolehModul('tech-note')) try {
    if (tanpaBatas) {
      const { data } = await supabase.from('tech_notes')
        .select('id, title, description, product, author_name, status')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%,product.ilike.%${q}%,author_name.ilike.%${q}%`)
        .order('submitted_at', { ascending: false }).limit(10);
      (data ?? []).forEach((t) => res.push({
        id: `technote-${t.id}`, type: 'technote', icon: '📝',
        title: t.title ?? '-',
        sub: t.product ?? '-',
        meta: t.author_name ?? '-',
        badge: t.status,
        badgeColor: t.status === 'approved' ? '#10b981' : t.status === 'rejected' ? '#ef4444' : '#f59e0b',
        url: '/tech-note',
      }));
    }
  } catch (e) { console.error('[search] tech note:', e); }
}
