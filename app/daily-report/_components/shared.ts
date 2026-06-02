import { supabase } from '@/lib/supabase';

// ─── Re-export konstanta global (sama persis dengan reminder-schedule) ────────
export { CATEGORIES, CATEGORY_CONFIG, SALES_DIVISIONS, PIE_COLORS, formatDate, formatDatetime } from '@/app/reminder-schedule/_components/shared';
export type { Priority, Status, RepeatType, TeamUser, GuestUser } from '@/app/reminder-schedule/_components/shared';

// ─── Tipe sumber entry ────────────────────────────────────────────────────────
export type EntrySource = 'reminder' | 'ticket' | 'manual';

// ─── Aktivitas dari Reminder (auto-populate) ──────────────────────────────────
export interface ReminderActivity {
  reminder_id: string;
  title: string;
  category: string;
  project_name: string;
  address: string;
  due_time: string;
  status: string;            // 'pending' | 'done' | 'cancelled'
  sales_name?: string;
  sales_division?: string;
  product?: string;
  pic_name?: string;
  pic_phone?: string;
  description?: string;
}

// ─── Aktivitas dari Ticket / Activity Log (auto-populate) ────────────────────
export interface TicketActivity {
  ticket_id: string;
  project_name: string;
  address?: string;
  issue_case: string;        // = kategori ticket (Troubleshooting, dll.)
  action_taken: string;
  new_status: string;
  log_time: string;          // created_at jam:menit
  sales_name?: string;
  sales_division?: string;
}

// ─── Aktivitas tambahan manual ────────────────────────────────────────────────
// FIX: submitted_by auto-filled dari currentUser — tidak listing semua orang
export interface ManualActivity {
  _key: string;              // client-only unique key
  category: string;
  project_name: string;
  address: string;
  description: string;
  sales_name: string;
  sales_division: string;
  pic_name: string;
  pic_phone: string;
  submitted_by?: string;     // NEW: username yang submit (auto dari currentUser)
}

// ─── Record Tim (insert supervisor, tidak ada foto) ───────────────────────────
export interface TeamEntry {
  _key: string;              // client-only
  member_user_id: string;
  member_name: string;
  category: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  supervisor_notes: string;
}

// ─── Tipe utama Daily Report ──────────────────────────────────────────────────
export interface DailyReport {
  id: string;
  report_date: string;                       // 'YYYY-MM-DD'
  user_id: string;
  user_name: string;
  sales_division: string;
  reminder_activities: ReminderActivity[];   // jsonb[]
  ticket_activities: TicketActivity[];       // jsonb[]
  manual_activities: ManualActivity[];       // jsonb[]
  reminder_notes: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

// ─── Tipe Team Entry record (tabel terpisah) ──────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatLogTime(isoStr: string): string {
  if (!isoStr) return '-';
  const d = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
}

// ─── FIX: Fetch Reminder activities — gunakan username langsung ────────────────
export async function fetchReminderActivities(
  username: string,
  date: string
): Promise<ReminderActivity[]> {
  if (!username || !date) return [];

  const { data, error } = await supabase
    .from('reminders')
    .select('id,title,category,project_name,address,due_time,status,sales_name,sales_division,product,pic_name,pic_phone,description')
    .eq('assigned_to', username)
    .eq('due_date', date)
    .order('due_time', { ascending: true });

  if (error || !data) return [];
  return data.map((r: any) => ({
    reminder_id: r.id,
    title: r.title ?? r.project_name,
    category: r.category,
    project_name: r.project_name,
    address: r.address ?? '',
    due_time: r.due_time ?? '',
    status: r.status,
    sales_name: r.sales_name ?? '',
    sales_division: r.sales_division ?? '',
    product: r.product ?? '',
    pic_name: r.pic_name ?? '',
    pic_phone: r.pic_phone ?? '',
    description: r.description ?? '',
  }));
}

// ─── FIX: Fetch Ticket activities — gunakan username langsung ─────────────────
export async function fetchTicketActivities(
  username: string,
  date: string
): Promise<TicketActivity[]> {
  if (!username || !date) return [];

  // activity_logs pakai created_at timestamp → filter WIB (UTC+7)
  const startUTC = new Date(date + 'T00:00:00+07:00').toISOString();
  const endUTC   = new Date(date + 'T23:59:59+07:00').toISOString();

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id,ticket_id,action_taken,notes,new_status,team_type,created_at,tickets(project_name,address,issue_case,sales_name,sales_division)')
    .eq('handler_username', username)
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Deduplikasi per ticket_id — ambil log terakhir per tiket
  const seen = new Map<string, TicketActivity>();
  for (const log of data as any[]) {
    const t = log.tickets as any;
    const act: TicketActivity = {
      ticket_id: log.ticket_id ?? log.id,
      project_name: t?.project_name ?? '-',
      address: t?.address ?? '',
      issue_case: t?.issue_case ?? 'Troubleshooting',
      action_taken: log.action_taken ?? log.notes ?? '-',
      new_status: log.new_status ?? '-',
      log_time: formatLogTime(log.created_at),
      sales_name: t?.sales_name ?? '',
      sales_division: t?.sales_division ?? '',
    };
    seen.set(log.ticket_id ?? log.id, act);
  }
  return Array.from(seen.values());
}

// ─── Fetch existing DailyReport untuk user+date ───────────────────────────────
export async function fetchExistingReport(
  userId: string,
  date: string
): Promise<DailyReport | null> {
  const { data } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_date', date)
    .maybeSingle();
  return data ?? null;
}

// ─── Fetch semua report (list) ────────────────────────────────────────────────
export async function fetchReports(filters: {
  date?: string;
  userId?: string;
  isAdmin: boolean;
  currentUserId: string;
}): Promise<DailyReport[]> {
  let q = supabase.from('daily_reports').select('*').order('report_date', { ascending: false }).order('created_at', { ascending: false });
  if (!filters.isAdmin) q = q.eq('user_id', filters.currentUserId);
  if (filters.date)   q = q.eq('report_date', filters.date);
  if (filters.userId && filters.isAdmin) q = q.eq('user_id', filters.userId);
  const { data } = await q;
  return (data ?? []) as DailyReport[];
}

// ─── Save (upsert) DailyReport ────────────────────────────────────────────────
export async function saveReport(payload: Omit<DailyReport, 'id' | 'created_at'> & { id?: string }): Promise<{ ok: boolean; error?: string }> {
  const { id, ...rest } = payload;
  if (id) {
    const { error } = await supabase.from('daily_reports').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await supabase.from('daily_reports').insert([rest]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── Save Team Entries (batch upsert per tanggal+member) ─────────────────────
export async function saveTeamEntries(
  entries: Omit<DailyReportTeamEntry, 'id' | 'created_at'>[],
  reportDate: string,
  enteredBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!entries.length) return { ok: true };

  // Hapus lama dulu untuk tanggal+entered_by ini, lalu insert ulang
  await supabase
    .from('daily_report_team_entries')
    .delete()
    .eq('report_date', reportDate)
    .eq('entered_by', enteredBy);

  const rows = entries.map(e => ({ ...e, entered_by: enteredBy, source: 'manual' as const }));
  const { error } = await supabase.from('daily_report_team_entries').insert(rows);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── SQL migration hint (bukan dieksekusi, hanya referensi) ──────────────────
export const SQL_MIGRATION = `
-- ── Tabel utama: satu record per orang per hari ──────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date         date NOT NULL,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  user_name           text NOT NULL,
  sales_division      text,
  reminder_activities jsonb NOT NULL DEFAULT '[]',
  ticket_activities   jsonb NOT NULL DEFAULT '[]',
  manual_activities   jsonb NOT NULL DEFAULT '[]',
  reminder_notes      text,
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz,
  CONSTRAINT uq_daily_report_user_date UNIQUE (user_id, report_date)
);

-- ── Tabel team entries: insert manual supervisor (tidak ada foto) ─────────────
CREATE TABLE IF NOT EXISTS daily_report_team_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date       date NOT NULL,
  member_user_id    uuid REFERENCES users(id),
  member_name       text NOT NULL,
  category          text NOT NULL,
  project_name      text NOT NULL,
  address           text,
  sales_name        text,
  sales_division    text,
  supervisor_notes  text,
  entered_by        text NOT NULL,
  source            text NOT NULL DEFAULT 'manual',  -- 'manual' | 'gsheet_import'
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Index untuk query cepat ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_reports_date   ON daily_reports (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user   ON daily_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_team_entries_date    ON daily_report_team_entries (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_entries_member  ON daily_report_team_entries (member_user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_team_entries ENABLE ROW LEVEL SECURITY;
`;
