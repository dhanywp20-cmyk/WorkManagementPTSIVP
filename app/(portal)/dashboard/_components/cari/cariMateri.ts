'use client';

import { supabase } from '@/lib/supabase';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariMateri {
  bolehModul: (kunci: string) => boolean;
  q: string;
  res: SearchResult[];
}

export async function cariMateri(k: KonteksCariMateri) {
  const { bolehModul, q, res } = k;
  if (bolehModul('learning-center')) try {
    const { data } = await supabase.from('lc_materials')
      .select('id, materi_name')
      .ilike('materi_name', `%${q}%`)
      .order('materi_name').limit(8);
    (data ?? []).forEach((m: any) => res.push({
      id: `materi-${m.id}`, type: 'materi', icon: '🎓',
      title: m.materi_name ?? '-',
      sub: 'Materi Learning Center',
      meta: '',
      url: '/learning-center',
    }));
  } catch (e) { console.error('[search] materi:', e); }
}
