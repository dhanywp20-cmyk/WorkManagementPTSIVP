'use client';

import { supabase } from '@/lib/supabase';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariDailyReport {
  bolehModul: (kunci: string) => boolean;
  q: string;
  tanpaBatas: boolean;
  batasiLingkup: <T>(lingkup: LingkupProject, query: T, kolomMilik: string[], kolomDivisi?: string) => T;
  lingkup: LingkupProject;
  res: SearchResult[];
}

export async function cariDailyReport(k: KonteksCariDailyReport) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, res } = k;
  if (bolehModul('daily-report')) try {
    let qd = supabase.from('daily_reports')
      .select('id, report_date, user_name, sales_division, reminder_notes')
      .or(`user_name.ilike.%${q}%,reminder_notes.ilike.%${q}%,sales_division.ilike.%${q}%`)
      .order('report_date', { ascending: false }).limit(10);
    if (!tanpaBatas) qd = batasiLingkup(lingkup, qd, ['user_name']);
    const { data } = await qd;
    (data ?? []).forEach((d: any) => res.push({
      id: `daily-${d.id}`, type: 'daily', icon: '📋',
      title: `Laporan ${d.user_name ?? '-'}`,
      sub: d.reminder_notes || 'Tanpa catatan',
      meta: d.report_date ?? '-',
      url: '/daily-report',
    }));
  } catch (e) { console.error('[search] daily report:', e); }
}
