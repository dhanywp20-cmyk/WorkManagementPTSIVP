'use client';

import { supabase } from '@/lib/supabase';
import { cariReminderByNama } from '@/lib/jadwal/cari-reminder';
import { type LingkupProject } from '@/lib/project-scope';
import { type SearchResult } from '../cari-global-tipe';

export interface KonteksCariJadwal {
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

export async function cariJadwal(k: KonteksCariJadwal) {
  const { bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
    res } = k;
  if (bolehModul('reminder-schedule')) try {
    const KOLOM_REMINDER =
      'id, project_name, category, due_date, assign_name, sales_name, sales_division, status';
    const namaRes = await cariReminderByNama<any>(q, KOLOM_REMINDER, 20,
      kueri => (tanpaBatas ? kueri : batasiLingkup(lingkup, kueri, ['sales_name', 'created_by'])));
    if (namaRes.error) console.error('[search] reminders (nama):', namaRes.error.message);

    let qr = supabase.from('reminders')
      .select(KOLOM_REMINDER)
      .or(`category.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,address.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(20);
    if (!tanpaBatas) qr = batasiLingkup(lingkup, qr, ['sales_name', 'created_by']);
    const { data: rData, error: rErr } = await qr;
    if (rErr) console.error('[search] reminders (pendukung):', rErr.message);

    const terlihat = new Set<string>();
    let reminders = [...namaRes.data, ...((rData ?? []))]
      .filter((r: any) => !terlihat.has(String(r.id)) && terlihat.add(String(r.id)));

    if (tanpaBatas) {
    } else if (isSalesSup) {
      reminders = reminders.filter((r: any) =>
        salesDivisions.includes(r.sales_division) ||
        salesSubNames.some(n => n === r.sales_name)
      );
    }

    reminders.forEach((r: any) => res.push({
      id: `reminder-${r.id}`, type: 'reminder', icon: '🗓️',
      title: r.project_name || r.title || '-',
      sub: `${r.category} · ${r.due_date ?? '-'}`,
      meta: r.assign_name ?? '-',
      badge: r.status,
      badgeColor: r.status === 'done' ? '#10b981' : r.status === 'cancelled' ? '#6b7280' : '#f59e0b',
      url: '/reminder-schedule',
    }));
  } catch (e) { console.error('[search] reminders:', e); }
}
