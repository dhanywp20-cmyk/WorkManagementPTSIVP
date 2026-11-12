'use client';

import { supabase } from '@/lib/supabase';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariUnitMovement {
  bolehModul: (kunci: string) => boolean;
  tanpaBatas: boolean;
  q: string;
  isPTSsup: boolean;
  ptsMemberNames: string[];
  res: SearchResult[];
}

export async function cariUnitMovement(k: KonteksCariUnitMovement) {
  const { bolehModul, tanpaBatas, q, isPTSsup, ptsMemberNames, res } = k;
  if (bolehModul('unit-movement')) try {
    if (tanpaBatas) {
      const { data: uData } = await supabase.from('movement_logs')
        .select('id, project_name, event, status_barang, nama_pts, tanggal, serial_number')
        .or(`project_name.ilike.%${q}%,event.ilike.%${q}%,nama_pts.ilike.%${q}%,serial_number.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(10);
      let units = (uData ?? []);

      if (isPTSsup && ptsMemberNames.length) {
        units = units.filter((u) => ptsMemberNames.some(n => n === u.nama_pts));
      }

      units.forEach((u: any) => res.push({
        id: `unit-${u.id}`, type: 'unit', icon: '🚚',
        title: u.project_name ?? u.event ?? '-',
        sub: `${u.status_barang} · ${u.nama_pts ?? '-'}`,
        meta: u.tanggal ?? '-',
        badge: u.status_barang,
        badgeColor: u.status_barang === 'Masuk' ? '#10b981' : '#f59e0b',
        url: '/unit-movement',
      }));
    }
  } catch (e) { console.error('[search] units:', e); }
}
