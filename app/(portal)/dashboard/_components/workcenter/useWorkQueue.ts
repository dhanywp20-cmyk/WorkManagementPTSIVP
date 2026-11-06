'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '../shared';
import { isAdminRole, isTeamMember } from '../widgets/permissions';
import { hariIni as todayStr, keadaanJadwal, statDari } from '@/lib/checklist/inti';

interface TugasChecklist {
  id: string;
  judul: string;
  target_date: string | null;
  proyek: string;
  total: number;
  selesai: number;
  kendala: number;
}

async function tugasChecklist(userId: string, batasTarget: string): Promise<{ data: TugasChecklist[] }> {
  const { data: ang, error } = await supabase.from('checklist_anggota').select('daftar_id').eq('user_id', userId).limit(200);
  if (error) throw error;
  const ids = ((ang ?? []) as { daftar_id: string }[]).map(a => a.daftar_id);
  if (!ids.length) return { data: [] };
  const [{ data: daftar, error: dErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from('checklist_daftar').select('id, judul, target_date, proyek_id').in('id', ids),
    supabase.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', ids).limit(5000),
  ]);
  if (dErr) throw dErr;
  if (iErr) throw iErr;
  const proyekIds = Array.from(new Set(((daftar ?? []) as { proyek_id: string }[]).map(d => d.proyek_id)));
  const { data: proyek } = proyekIds.length
    ? await supabase.from('checklist_proyek').select('id, nama, status').in('id', proyekIds)
    : { data: [] };
  const petaProyek = new Map(((proyek ?? []) as { id: string; nama: string; status: string }[]).map(p => [p.id, p]));
  const semuaItem = (items ?? []) as { daftar_id: string; selesai: boolean; kendala: boolean }[];

  return {
    data: ((daftar ?? []) as { id: string; judul: string; target_date: string | null; proyek_id: string }[])
      .filter(d => petaProyek.get(d.proyek_id)?.status !== 'done')
      .map(d => ({
        id: d.id, judul: d.judul, target_date: d.target_date,
        proyek: petaProyek.get(d.proyek_id)?.nama ?? '',
        ...statDari(semuaItem.filter(i => i.daftar_id === d.id)),
      }))
      .filter(t => t.kendala > 0 || (t.target_date !== null && t.target_date <= batasTarget && !(t.total > 0 && t.selesai === t.total))),
  };
}

export type Urgency = 'urgent' | 'pending' | 'upcoming';

export interface ActionItem {
  id: string;
  urgency: Urgency;
  icon: string;
  title: string;
  subtitle: string;
  menuKey: string;
  isToday: boolean;
  date: string | null;
}

export interface WorkQueueResult {
  loading: boolean;
  error: boolean;
  myAction: ActionItem[];
  today: ActionItem[];
  upcoming: ActionItem[];
}

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, pending: 1, upcoming: 2 };

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function addDays(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function useWorkQueue(user: User): WorkQueueResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(false);
      const today = todayStr();
      const horizon = addDays(today, 5);
      const list: ActionItem[] = [];

      try {
        if (isTeamMember(user) || isAdminRole(user)) {
          const [{ data: rem }, { data: tix }, { data: rep }, { data: locs }] = await Promise.all([
            supabase.from('reminders')
              .select('id, project_name, due_date, status')
              .eq('assigned_to', user.username).eq('status', 'pending')
              .lte('due_date', horizon).order('due_date', { ascending: true }).limit(40),
            supabase.from('tickets')
              .select('id, project_name, issue_case, status, date, overdue_hours')
              .eq('assign_name', user.full_name).neq('status', 'Solved')
              .order('date', { ascending: true }).limit(20),
            supabase.from('daily_reports').select('id').eq('user_id', user.id).eq('report_date', today).limit(1),
            tugasChecklist(user.id, addDays(today, 3)).catch(() => ({ data: [] as TugasChecklist[] })),
          ]);

          for (const r of (rem ?? []) as { id: string; project_name: string; due_date: string }[]) {
            const diff = daysBetween(today, r.due_date);
            list.push({
              id: `rem-${r.id}`,
              urgency: diff < 0 ? 'urgent' : diff === 0 ? 'pending' : 'upcoming',
              icon: '🗓️', title: r.project_name,
              subtitle: diff < 0 ? `Jadwal terlambat ${Math.abs(diff)} hari` : diff === 0 ? 'Jadwal hari ini' : `${diff} hari lagi`,
              menuKey: 'reminder-schedule', isToday: diff === 0, date: r.due_date,
            });
          }

          for (const t of (tix ?? []) as { id: string; project_name: string; issue_case: string; date: string; overdue_hours: number | null }[]) {
            const overdue = (t.overdue_hours ?? 0) > 0;
            list.push({
              id: `tix-${t.id}`, urgency: overdue ? 'urgent' : 'pending',
              icon: '🎫', title: t.issue_case || t.project_name,
              subtitle: overdue ? `Ticket overdue ${Math.round(t.overdue_hours ?? 0)} jam` : 'Ticket aktif',
              menuKey: 'ticket-troubleshooting', isToday: t.date === today, date: t.date,
            });
          }

          if (!(rep ?? []).length) {
            list.push({
              id: 'daily-report-today', urgency: 'pending', icon: '📈',
              title: 'Daily Report hari ini belum diisi', subtitle: 'Isi sebelum jam kerja berakhir',
              menuKey: 'daily-report', isToday: true, date: today,
            });
          }

          for (const t of locs ?? []) {
            const tuntas = t.total > 0 && t.selesai === t.total;
            const j = keadaanJadwal(t.target_date, tuntas, today);
            const terlambat = j.keadaan === 'terlambat';
            list.push({
              id: `cl-${t.id}`, urgency: terlambat || t.kendala > 0 ? 'urgent' : 'pending',
              icon: t.kendala > 0 ? '⚠' : '📍', title: `${t.judul}${t.proyek ? ` · ${t.proyek}` : ''}`,
              subtitle: [t.kendala > 0 ? `${t.kendala} item berkendala` : null, j.keadaan !== 'aman' && j.keadaan !== 'tanpa' ? j.label : null,
                `${t.selesai}/${t.total} selesai`].filter(Boolean).join(' · '),
              menuKey: 'project-progress', isToday: j.label === 'Target hari ini', date: t.target_date,
            });
          }
        } else {
          const [{ data: rem }, { data: tix }, { data: projs }] = await Promise.all([
            supabase.from('reminders')
              .select('id, project_name, due_date, status, rejection_reason, sales_name, created_by')
              .or(`sales_name.eq.${user.full_name},created_by.eq.${user.username}`)
              .order('due_date', { ascending: true }).limit(60),
            supabase.from('tickets')
              .select('id, project_name, issue_case, status, date, created_by, sales_name')
              .or(`created_by.eq.${user.username},sales_name.eq.${user.full_name}`)
              .neq('status', 'Solved').order('date', { ascending: true }).limit(20),
            supabase.from('checklist_proyek')
              .select('id, nama, status, target_date, sales_name')
              .eq('sales_name', user.full_name).neq('status', 'done').limit(80),
          ]);

          for (const r of (rem ?? []) as { id: string; project_name: string; due_date: string | null; status: string; rejection_reason: string | null }[]) {
            if (r.status === 'cancelled' && r.rejection_reason) {
              list.push({
                id: `rem-rej-${r.id}`, urgency: 'urgent', icon: '⛔',
                title: r.project_name, subtitle: `Ditolak: ${r.rejection_reason}`,
                menuKey: 'reminder-schedule', isToday: false, date: null,
              });
              continue;
            }
            if (r.status !== 'pending' || !r.due_date) continue;
            const diff = daysBetween(today, r.due_date);
            if (diff > 5) continue;
            list.push({
              id: `rem-${r.id}`,
              urgency: diff < 0 ? 'urgent' : diff === 0 ? 'pending' : 'upcoming',
              icon: '🗓️', title: r.project_name,
              subtitle: diff < 0 ? `Jadwal terlambat ${Math.abs(diff)} hari` : diff === 0 ? 'Jadwal hari ini' : `${diff} hari lagi`,
              menuKey: 'reminder-schedule', isToday: diff === 0, date: r.due_date,
            });
          }

          for (const t of (tix ?? []) as { id: string; project_name: string; issue_case: string; date: string }[]) {
            list.push({
              id: `tix-${t.id}`, urgency: 'pending', icon: '🎫',
              title: t.issue_case || t.project_name, subtitle: 'Ticket masih berjalan',
              menuKey: 'ticket-troubleshooting', isToday: t.date === today, date: t.date,
            });
          }

          for (const p of (projs ?? []) as { id: string; nama: string; target_date: string | null }[]) {
            const j = keadaanJadwal(p.target_date, false, today);
            if (j.keadaan !== 'terlambat' && j.keadaan !== 'dekat') continue;
            list.push({
              id: `proj-${p.id}`, urgency: j.keadaan === 'terlambat' ? 'urgent' : 'pending',
              icon: '📊', title: p.nama, subtitle: j.label,
              menuKey: 'project-progress', isToday: j.label === 'Target hari ini', date: p.target_date,
            });
          }
        }
      } catch {
        if (alive) setError(true);
      }

      if (alive) { setItems(list); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user.id, user.username, user.full_name]);

  const myAction = items
    .filter(i => i.urgency === 'urgent' || i.urgency === 'pending')
    .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 8);
  const today = items.filter(i => i.isToday);
  const upcoming = items
    .filter(i => !i.isToday && i.urgency === 'upcoming')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 6);

  return { loading, error, myAction, today, upcoming };
}
