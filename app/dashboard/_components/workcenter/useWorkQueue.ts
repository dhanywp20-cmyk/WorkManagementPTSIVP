'use client';

/**
 * useWorkQueue.ts - satu titik fetch untuk seksi "My Action" / "Today" /
 * "Upcoming" di Work Center.
 *
 * SATU pemanggilan query per sumber data (reminders/tickets/daily_reports/
 * project locations), diklasifikasi client-side ke tiga ember - bukan tiga
 * fetch terpisah untuk tiga seksi yang menampilkan potongan data yang sama.
 *
 * Filter "milik saya" SENGAJA menyalin pola yang SUDAH dipakai modul
 * aslinya, bukan aturan baru:
 *   - reminders.assigned_to === username         (reminder-schedule/page.tsx)
 *   - tickets.assign_name === full_name           (ticketing/page.tsx)
 *   - progress_locations: isPicOfLocation()        (project-progress/shared.ts)
 *   - progress_projects: isSalesOfLocation() via sales_name (RLS pp_select
 *     memakai jwt_full_name() = sales_name, BUKAN kolom sales_user_id -
 *     lihat sql/full-schema/04_rls.sql)
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '../shared';
import { isAdminRole, isTeamMember } from '../widgets/permissions';
import {
  isPicOfLocation, isSalesOfLocation, timelineInfo, todayStr,
  type ProgressLocation, type ProgressProject,
} from '@/app/project-progress/_components/shared';

export type Urgency = 'urgent' | 'pending' | 'upcoming';

export interface ActionItem {
  id: string;
  urgency: Urgency;
  icon: string;
  title: string;
  subtitle: string;
  menuKey: string;
  /** Bagian dari agenda HARI INI - dipakai seksi Today, independen dari urgency. */
  isToday: boolean;
  /** ISO date (YYYY-MM-DD) untuk urutan Upcoming. Null kalau tak relevan (mis. item ditolak). */
  date: string | null;
}

export interface WorkQueueResult {
  loading: boolean;
  /** true kalau query-nya GAGAL - beda dari "berhasil dimuat dan memang kosong". */
  error: boolean;
  myAction: ActionItem[];
  today: ActionItem[];
  upcoming: ActionItem[];
}

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, pending: 1, upcoming: 2 };

/** Selisih hari kalender (b - a), format YYYY-MM-DD. Aritmetika tanggal lokal - hindari toISOString(). */
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
          // ── TEAM / TECHNICAL ──────────────────────────────────────────
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
            supabase.from('progress_locations')
              .select('id, name, pic, status, target_date, sales_name, start_date, origin, source_reminder_id, note, note_flag, progress, sort_order, project_id, created_at, sales_division')
              .neq('status', 'done').limit(150),
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

          for (const l of (locs ?? []) as ProgressLocation[]) {
            if (!isPicOfLocation(l, user.full_name)) continue;
            const info = timelineInfo(l, today);
            if (info.state !== 'overdue' && info.state !== 'due_soon') continue;
            list.push({
              id: `loc-${l.id}`, urgency: info.state === 'overdue' ? 'urgent' : 'pending',
              icon: '📍', title: l.name, subtitle: info.label,
              menuKey: 'project-progress', isToday: false, date: l.target_date,
            });
          }
        } else {
          // ── SALES / GUEST ─────────────────────────────────────────────
          const [{ data: rem }, { data: tix }, { data: projs }] = await Promise.all([
            supabase.from('reminders')
              .select('id, project_name, due_date, status, rejection_reason, sales_name, created_by')
              .or(`sales_name.eq.${user.full_name},created_by.eq.${user.username}`)
              .order('due_date', { ascending: true }).limit(60),
            supabase.from('tickets')
              .select('id, project_name, issue_case, status, date, created_by, sales_name')
              .or(`created_by.eq.${user.username},sales_name.eq.${user.full_name}`)
              .neq('status', 'Solved').order('date', { ascending: true }).limit(20),
            supabase.from('progress_projects')
              .select('id, name, status, target_date, sales_name, start_date, origin, source_reminder_id, share_token, share_enabled, created_by, created_at, updated_at, client, description, sales_division')
              .neq('status', 'done').limit(80),
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

          for (const p of (projs ?? []) as ProgressProject[]) {
            if (!isSalesOfLocation(p, user.full_name)) continue;
            const info = timelineInfo(p, today);
            if (info.state !== 'overdue' && info.state !== 'due_soon') continue;
            list.push({
              id: `proj-${p.id}`, urgency: info.state === 'overdue' ? 'urgent' : 'pending',
              icon: '📊', title: p.name, subtitle: info.label,
              menuKey: 'project-progress', isToday: false, date: p.target_date,
            });
          }
        }
      } catch {
        //  GAGAL memuat - beda dari "berhasil, dan memang tidak ada tugas".
        //  Tanpa pembeda ini, query yang gagal diam-diam terlihat identik
        //  dengan "Anda bersih, tidak ada kerjaan" - pesan yang salah arah.
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
