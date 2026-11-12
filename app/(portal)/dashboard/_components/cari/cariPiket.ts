'use client';

import { supabase } from '@/lib/supabase';
import { bacaPicPiket } from '@/lib/piket/inti';
import { User } from '../shared';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariPiket {
  bolehModul: (kunci: string) => boolean;
  q: string;
  isSalesBiasa: boolean;
  isSalesSup: boolean;
  isPTSsup: boolean;
  currentUser: User;
  ql: string;
  res: SearchResult[];
}

export async function cariPiket(k: KonteksCariPiket) {
  const { bolehModul, q, isSalesBiasa, isSalesSup, isPTSsup, currentUser, ql, res } = k;
  if (bolehModul('picket-showroom')) try {
    const { data: pkData } = await supabase.from('piket_schedules')
      .select('id, day_date, day_of_week, pic, pic_ivp_name, pic_ump_name, pic_mvi_name, pic_ivp_id, pic_ump_id, pic_mvi_id')
      .or(`pic_ivp_name.ilike.%${q}%,pic_ump_name.ilike.%${q}%,pic_mvi_name.ilike.%${q}%,day_date.ilike.%${q}%`)
      .order('day_date', { ascending: false }).limit(10);
    let pikets = (pkData ?? []) as any[];

    if (isSalesBiasa || isSalesSup) {
      pikets = [];
    } else if (isPTSsup) {
      const myTeam = currentUser.team_type;
      pikets = pikets.filter((p: any) => {
        const pic = bacaPicPiket(p);
        if (!pic) return false;
        return pic.team_type === myTeam && (pic.name ?? '').toLowerCase().includes(ql);
      });
    }

    pikets.forEach((p: any) => res.push({
      id: `piket-${p.id}`, type: 'piket', icon: '🏪',
      title: `Piket ${p.day_of_week ?? ''} ${p.day_date ?? ''}`,
      sub: [p.pic_ivp_name, p.pic_ump_name, p.pic_mvi_name].filter(Boolean).join(' · ') || '-',
      meta: p.day_date ?? '-',
      url: '/picket-showroom',
    }));
  } catch (e) { console.error('[search] piket:', e); }
}
