'use client';

import { supabase } from '@/lib/supabase';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariPengguna {
  isAdmin: boolean;
  q: string;
  res: SearchResult[];
}

export async function cariPengguna(k: KonteksCariPengguna) {
  const { isAdmin, q, res } = k;
  try {
    if (isAdmin) {
      const { data: usrData } = await supabase.from('users')
        .select('id, full_name, username, role, team_type, sales_division')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,sales_division.ilike.%${q}%`)
        .limit(8);
      (usrData ?? []).forEach((u: any) => res.push({
        id: `user-${u.id}`, type: 'user', icon: '👤',
        title: u.full_name ?? '-',
        sub: u.username ?? '-',
        meta: `${u.role}${u.team_type ? ` · ${u.team_type}` : ''}${u.sales_division ? ` · ${u.sales_division}` : ''}`,
      }));
    }
  } catch (e) { console.error('[search] users:', e); }
}
