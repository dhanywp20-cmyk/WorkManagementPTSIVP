import { supabase } from '@/lib/supabase';

export { CATEGORIES, CATEGORY_CONFIG, SALES_DIVISIONS, PIE_COLORS, formatDate, formatDatetime } from '@/app/reminder-schedule/_components/shared';
export type { Priority, Status, RepeatType, TeamUser, GuestUser } from '@/app/reminder-schedule/_components/shared';

export type EntrySource = 'reminder' | 'ticket' | 'manual';

export interface ReminderActivity {
  reminder_id: string;
  title: string;
  category: string;
  project_name: string;
  address: string;
  due_time: string;
  status: string;
  sales_name?: string;
  sales_division?: string;
  product?: string;
  pic_name?: string;
  pic_phone?: string;
  description?: string;
  handler_name?: string;
  report_date?: string;
}

export interface TicketActivity {
  ticket_id: string;
  project_name: string;
  address?: string;
  issue_case: string;
  action_taken: string;
  new_status: string;
  log_time: string;
  sales_name?: string;
  sales_division?: string;
  handler_name?: string;
  report_date?: string;
}

export interface ManualActivity {
  _key: string;
  category: string;
  project_name: string;
  address: string;
  description: string;
  sales_name: string;
  sales_division: string;
  pic_name: string;
  pic_phone: string;
  submitted_by?: string;
}

export interface TeamEntry {
  _key: string;
  member_user_id: string;
  member_name: string;
  category: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  supervisor_notes: string;
}

export interface DailyReport {
  id: string;
  report_date: string;
  user_id: string;
  user_name: string;
  sales_division: string;
  reminder_activities: ReminderActivity[];
  ticket_activities: TicketActivity[];
  manual_activities: ManualActivity[];
  reminder_notes: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface DailyReportTeamEntry {
  id: string;
  report_date: string;
  member_user_id: string;
  member_name: string;
  category: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  supervisor_notes: string;
  entered_by: string;
  source: 'manual' | 'gsheet_import';
  created_at: string;
}

// ─── Unified flat row untuk listing real-time ──────────────────────────────────
export interface LiveRow {
  source: 'reminder' | 'ticket' | 'manual';
  id: string;
  report_date: string;
  project_name: string;
  address: string;
  product: string;
  category: string;
  kegiatan_icon: string;
  kegiatan_label: string;
  sales_name: string;
  sales_division: string;
  handler_name: string;
  handler_username: string;
  status: string;
  jam: string;
  raw_reminder?: ReminderActivity;
  raw_ticket?: TicketActivity;
  // link ke daily_report jika sudah di-submit
  report_id?: string;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatLogTime(isoStr: string): string {
  if (!isoStr) return '-';
  const d = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
}

// ─── Fetch semua reminder dari SEMUA team users (untuk listing real-time) ──────
export async function fetchAllReminders(opts: {
  date?: string;
  usernames?: string[];   // filter by assigned_to
}): Promise<ReminderActivity[]> {
  let q = supabase
    .from('reminders')
   .select('id,category,project_name,address,due_date,due_time,status,sales_name,sales_division,product,pic_name,pic_phone,description,assigned_to')
    .order('due_date', { ascending: false })
    .order('due_time', { ascending: true });

  if (opts.date) q = q.eq('due_date', opts.date);
  if (opts.usernames && opts.usernames.length > 0) {
    q = q.in('assigned_to', opts.usernames);
  }

  const { data, error } = await q;
  if (error) { console.error('[DR] fetchAllReminders:', error.message); return []; }
  return (data ?? []).map((r: any) => ({
    reminder_id: r.id,
    title: r.project_name,
    category: r.category ?? 'Internal',
    project_name: r.project_name ?? '',
    address: r.address ?? '',
    due_time: r.due_time ?? '',
    status: r.status ?? 'pending',
    sales_name: r.sales_name ?? '',
    sales_division: r.sales_division ?? '',
    product: r.product ?? '',
    pic_name: r.pic_name ?? '',
    pic_phone: r.pic_phone ?? '',
    description: r.description ?? '',
    handler_username: r.assigned_to ?? '',
    report_date: r.due_date ?? '',
  } as any));
}

// ─── Fetch semua ticket activity_logs (untuk listing real-time) ────────────────
export async function fetchAllTickets(opts: {
  date?: string;
  usernames?: string[];
}): Promise<TicketActivity[]> {
  let q = supabase
    .from('activity_logs')
    .select('id,ticket_id,action_taken,notes,new_status,created_at,handler_username,tickets(project_name,address,issue_case,sales_name,sales_division)')
    .order('created_at', { ascending: false });

  if (opts.date) {
    const startUTC = new Date(opts.date + 'T00:00:00+07:00').toISOString();
    const endUTC   = new Date(opts.date + 'T23:59:59+07:00').toISOString();
    q = q.gte('created_at', startUTC).lte('created_at', endUTC);
  }
  if (opts.usernames && opts.usernames.length > 0) {
    q = q.in('handler_username', opts.usernames);
  }

  const { data, error } = await q;
  if (error) { console.error('[DR] fetchAllTickets:', error.message); return []; }

  const seen = new Map<string, TicketActivity & { handler_username: string; report_date: string }>();
  for (const log of (data ?? []) as any[]) {
    const t = log.tickets as any;
    const key = log.ticket_id ?? log.id;
    if (!seen.has(key)) {
      const createdAt = log.created_at ?? '';
      seen.set(key, {
        ticket_id: key,
        project_name: t?.project_name ?? '-',
        address: t?.address ?? '',
        issue_case: t?.issue_case ?? 'Troubleshooting',
        action_taken: log.action_taken ?? log.notes ?? '-',
        new_status: log.new_status ?? '-',
        log_time: formatLogTime(createdAt),
        sales_name: t?.sales_name ?? '',
        sales_division: t?.sales_division ?? '',
        handler_username: log.handler_username ?? '',
        report_date: createdAt ? createdAt.split('T')[0] : '',
      } as any);
    }
  }
  return Array.from(seen.values());
}

// ─── Fetch Reminder untuk 1 user + date (dipakai di form) ─────────────────────
export async function fetchReminderActivities(username: string, date: string): Promise<ReminderActivity[]> {
  if (!username || !date) return [];
  const { data, error } = await supabase
    .from('reminders')
    .select('id,category,project_name,address,due_time,status,sales_name,sales_division,product,pic_name,pic_phone,description,assigned_to')
    .eq('assigned_to', username)
    .eq('due_date', date)
    .order('due_time', { ascending: true });
  if (error) { console.error('[DR] fetchReminderActivities:', error.message); return []; }
  return (data ?? []).map((r: any) => ({
    reminder_id: r.id,
    title: r.project_name,
    category: r.category ?? 'Internal',
    project_name: r.project_name ?? '',
    address: r.address ?? '',
    due_time: r.due_time ?? '',
    status: r.status ?? 'pending',
    sales_name: r.sales_name ?? '',
    sales_division: r.sales_division ?? '',
    product: r.product ?? '',
    pic_name: r.pic_name ?? '',
    pic_phone: r.pic_phone ?? '',
    description: r.description ?? '',
  }));
}

// ─── Fetch Ticket untuk 1 user + date (dipakai di form) ───────────────────────
export async function fetchTicketActivities(username: string, date: string): Promise<TicketActivity[]> {
  if (!username || !date) return [];
  const startUTC = new Date(date + 'T00:00:00+07:00').toISOString();
  const endUTC   = new Date(date + 'T23:59:59+07:00').toISOString();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id,ticket_id,action_taken,notes,new_status,created_at,handler_username,tickets(project_name,address,issue_case,sales_name,sales_division)')
    .eq('handler_username', username)
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true });
  if (error) { console.error('[DR] fetchTicketActivities:', error.message); return []; }
  const seen = new Map<string, TicketActivity>();
  for (const log of (data ?? []) as any[]) {
    const t = log.tickets as any;
    seen.set(log.ticket_id ?? log.id, {
      ticket_id: log.ticket_id ?? log.id,
      project_name: t?.project_name ?? '-',
      address: t?.address ?? '',
      issue_case: t?.issue_case ?? 'Troubleshooting',
      action_taken: log.action_taken ?? log.notes ?? '-',
      new_status: log.new_status ?? '-',
      log_time: formatLogTime(log.created_at),
      sales_name: t?.sales_name ?? '',
      sales_division: t?.sales_division ?? '',
    });
  }
  return Array.from(seen.values());
}

export async function fetchExistingReport(userId: string, date: string): Promise<DailyReport | null> {
  const { data } = await supabase.from('daily_reports').select('*').eq('user_id', userId).eq('report_date', date).maybeSingle();
  return data ?? null;
}

export async function fetchReports(filters: {
  date?: string; userId?: string; isAdmin: boolean; currentUserId: string;
}): Promise<DailyReport[]> {
  let q = supabase.from('daily_reports').select('*').order('report_date', { ascending: false }).order('created_at', { ascending: false });
  if (!filters.isAdmin) q = q.eq('user_id', filters.currentUserId);
  if (filters.date) q = q.eq('report_date', filters.date);
  if (filters.userId && filters.isAdmin) q = q.eq('user_id', filters.userId);
  const { data, error } = await q;
  if (error) { console.error('[DR] fetchReports:', error.message); return []; }
  return (data ?? []) as DailyReport[];
}

export async function saveReport(
  payload: Omit<DailyReport, 'id' | 'created_at'> & { id?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { id, ...rest } = payload;
  if (id) {
    const { error } = await supabase.from('daily_reports').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await supabase.from('daily_reports').insert([rest]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveTeamEntries(
  entries: Omit<DailyReportTeamEntry, 'id' | 'created_at'>[],
  reportDate: string,
  enteredBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!entries.length) return { ok: true };
  await supabase.from('daily_report_team_entries').delete().eq('report_date', reportDate).eq('entered_by', enteredBy);
  const rows = entries.map(e => ({ ...e, entered_by: enteredBy, source: 'manual' as const }));
  const { error } = await supabase.from('daily_report_team_entries').insert(rows);
  return error ? { ok: false, error: error.message } : { ok: true };
}
