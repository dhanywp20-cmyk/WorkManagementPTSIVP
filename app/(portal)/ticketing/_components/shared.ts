import { supabase } from '@/lib/supabase';
import { namaSemuaKelompokTim } from '@/lib/kelompok';
import { hasFullAccess } from '@/lib/constants';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import type { AdminField } from '@/lib/admin-edit';

export { sendWANotif } from '@/lib/wa';

import { JABATAN_TIER, JABATAN_CC_RULES as JABATAN_CC_RULES_KETAT } from '@/lib/jabatan';
const JABATAN_CC_RULES: Record<string, string[]> = JABATAN_CC_RULES_KETAT;
export { JABATAN_TIER, JABATAN_CC_RULES };

export async function fetchWACCTargets(
  userId: string,
  salesDiv: string
): Promise<{ phone: string; name: string; relation: string }[]> {
  const targets: { phone: string; name: string; relation: string }[] = [];
  try {
    const { data: userData } = await supabase.from("users").select("jabatan").eq("id", userId).maybeSingle();
    const jabatan = userData?.jabatan as string | undefined;

    if (jabatan && JABATAN_CC_RULES[jabatan]) {
      const ccJabatanList = JABATAN_CC_RULES[jabatan];
      if (ccJabatanList.length > 0) {
        const { data: supMaps } = await supabase
          .from("division_supervisor_mappings")
          .select("supervisor_id")
          .eq("sales_division", salesDiv);
        if (supMaps?.length) {
          const supIds = supMaps.map((m: any) => m.supervisor_id);
          const { data: sups } = await supabase.from("users")
            .select("full_name, phone_number, jabatan")
            .in("id", supIds)
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          sups?.forEach((s: any) => {
            if (s.jabatan && ccJabatanList.includes(s.jabatan)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: "supervisor" });
            }
          });
        }

        const { data: userSupMaps } = await supabase
          .from("user_supervisor_mappings")
          .select("supervisor_id")
          .eq("user_id", userId);
        if (userSupMaps?.length) {
          const manualSupIds = userSupMaps.map((m: any) => m.supervisor_id);
          const { data: manualSups } = await supabase.from("users")
            .select("full_name, phone_number, jabatan")
            .in("id", manualSupIds)
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          manualSups?.forEach((s: any) => {
            if (!targets.find(t => t.phone === s.phone_number)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: "supervisor" });
            }
          });
        }
      }
    }

    if (salesDiv && salesDiv !== "IVP") {
      const { data: ivpRes } = await supabase
        .from("division_ivp_mappings").select("ivp_id").eq("sales_division", salesDiv);
      if (ivpRes?.length) {
        const { data: ivps } = await supabase.from("users").select("full_name, phone_number")
          .in("id", ivpRes.map((s: any) => s.ivp_id))
          .not("phone_number", "is", null).neq("phone_number", "");
        ivps?.forEach((s: any) => {
          if (!targets.find(t => t.phone === s.phone_number)) {
            targets.push({ phone: s.phone_number, name: s.full_name, relation: "ivp_handler" });
          }
        });
      }
    }
  } catch (e) { console.warn("[fetchWACCTargets]", e); }
  return targets;
}

export const SERVICES_STATUSES = [
  "Waiting Approval",
  "Pending",
  "Warranty",
  "Out Of Warranty",
  "Waiting PO from Sales",
  "Submit RMA",
  "Waiting sparepart",
  "Process Repair",
  "Solved",
] as const;
export type ServicesStatus = (typeof SERVICES_STATUSES)[number];

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
  jabatan?: string | null;
  is_internal_sales?: boolean;
  access_level?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  username: string;
  photo_url: string;
  role: string;
  team_type: string;
  jabatan?: string | null;
  bisa_ditugaskan?: boolean | null;
}

export const JEDA_POLLING_MS = 120_000;

export const JEDA_GABUNG_REALTIME_MS = 800;
export const MAKS_SEGAR_SEBAGIAN = 10;
export const JEDA_DATA_PENDUKUNG_MS = 10 * 60_000;

export const KOLOM_LOG_RINGKAS =
  'id, ticket_id, handler_name, team_type, assigned_to_services, new_status, created_at';

export const RENTANG_BULAN_TIKET = 12;

export const TAHUN_TERBARU = 'terbaru';

export interface RentangTiket { dari: string; sebelum: string }

export function rentangTiket(filterTahun: string): RentangTiket {
  if (filterTahun && filterTahun !== TAHUN_TERBARU && /^\d{4}$/.test(filterTahun)) {
    const t = Number(filterTahun);
    return {
      dari: new Date(Date.UTC(t, 0, 1)).toISOString(),
      sebelum: new Date(Date.UTC(t + 1, 0, 1)).toISOString(),
    };
  }
  const dari = new Date();
  dari.setMonth(dari.getMonth() - RENTANG_BULAN_TIKET);
  return { dari: dari.toISOString(), sebelum: new Date(Date.UTC(3000, 0, 1)).toISOString() };
}

export interface ActivityLog {
  id: string;
  ticket_id?: string;
  handler_name: string;
  handler_username: string;
  action_taken: string;
  notes: string;
  file_url: string;
  file_name: string;
  photo_url?: string;
  photo_name?: string;
  new_status: string;
  team_type: string;
  assigned_to_services?: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  project_name: string;
  address?: string;
  customer_phone: string;
  sales_name: string;
  issue_case: string;
  description: string;
  sn_unit?: string;
  product?: string;
  assign_name: string;
  status: string;
  date: string;
  created_at: string;
  created_by?: string;
  current_team: string;
  services_status?: string;
  sales_division?: string;
  photo_url?: string;
  photo_name?: string;
  activity_logs?: ActivityLog[];
  rejection_reason?: string;
  reminder_id?: string | null | undefined;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  escalation_notified_at?: string | null;
  routing_status?: string | null;
  assigned_supervisor_id?: string | null;
  internal_sales_id?: string | null;
  internal_sales_id_2?: string | null;
  brand?: string | null;
}

export interface OverdueSetting {
  id: string;
  ticket_id: string;
  due_date: string | null;
  due_hours: number | null;
  set_by: string;
  created_at: string;
}

export const SALES_DIVISIONS = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
] as const;

export function formatDateTime(dateString: string) {
  if (!dateString) return "-";
  let normalized = dateString;
  if (!dateString.endsWith("Z") && !dateString.includes("+") && !(dateString.indexOf("-", 10) > -1)) {
    normalized = dateString + "Z";
  }
  const utcDate = new Date(normalized);
  if (isNaN(utcDate.getTime())) return dateString;
  const jakartaTime = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const year = jakartaTime.getUTCFullYear();
  const hours = String(jakartaTime.getUTCHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

export const TEAM_PTS = "Team PTS IVP";
export const TEAM_SERVICES = "Team Services";

export interface RingkasPenanganan {
  handlerPTS: string;
  teamHandler: string;
  keServices: boolean;
  catatanServices: string;
  statusLengkap: string;
}

export function ringkasPenanganan(t: {
  assign_name?: string | null;
  status?: string | null;
  current_team?: string | null;
  services_status?: string | null;
  activity_logs?: { handler_name?: string | null; team_type?: string | null;
                    assigned_to_services?: boolean; created_at?: string }[];
}): RingkasPenanganan {
  const logs = t.activity_logs ?? [];

  const logPTS = logs
    .filter(l => (l.team_type || TEAM_PTS) !== TEAM_SERVICES && String(l.handler_name || '').trim())
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];

  const handlerPTS = String(t.assign_name || '').trim() || String(logPTS?.handler_name || '').trim();

  const keServices = t.current_team === TEAM_SERVICES
    || !!t.services_status
    || logs.some(l => l.assigned_to_services);

  const catatanServices = keServices ? ` — dengan catatan: di-assign ke ${TEAM_SERVICES}` : '';

  return {
    handlerPTS,
    teamHandler: TEAM_PTS,
    keServices,
    catatanServices,
    statusLengkap: `${t.status ?? '-'}${catatanServices}`,
  };
}

export const statusColors: Record<string, string> = {
  "Waiting Approval": "bg-orange-50 text-orange-600 border-orange-200",
  Rejected: "bg-red-100 text-red-700 border-red-300",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Call: "bg-sky-50 text-sky-600 border-sky-200",
  Onsite: "bg-purple-50 text-purple-600 border-purple-200",
  "In Progress": "bg-blue-50 text-blue-600 border-blue-200",
  "Pending Action": "bg-orange-50 text-orange-700 border-orange-200",
  Solved: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Overdue: "bg-red-50 text-red-600 border-red-200",
  Warranty: "bg-green-50 text-green-700 border-green-300",
  "Out Of Warranty": "bg-red-50 text-red-700 border-red-300",
  "Waiting PO from Sales": "bg-amber-50 text-amber-700 border-amber-300",
  "Submit RMA": "bg-orange-50 text-orange-700 border-orange-300",
  "Waiting sparepart": "bg-rose-50 text-rose-700 border-rose-300",
  "Process Repair": "bg-blue-50 text-blue-700 border-blue-300",
};

export const DEFAULT_OVERDUE_HOURS = 48;

export function getDeadline(ticket: Ticket, overdueSettings: OverdueSetting[]): Date | null {
  const setting = overdueSettings.find((o) => o.ticket_id === ticket.id);
  if (setting) {
    if (setting.due_date) return new Date(setting.due_date);
    if (setting.due_hours && ticket.created_at)
      return new Date(new Date(ticket.created_at).getTime() + setting.due_hours * 3600000);
  }
  if (ticket.created_at)
    return new Date(new Date(ticket.created_at).getTime() + DEFAULT_OVERDUE_HOURS * 3600000);
  return null;
}

export function isTicketOverdue(ticket: Ticket, overdueSettings: OverdueSetting[]): boolean {
  const deadline = getDeadline(ticket, overdueSettings);
  if (!deadline) return false;
  if (ticket.status === "Solved") {
    const solvedLog = ticket.activity_logs?.filter((l) => l.new_status === "Solved").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (solvedLog) return new Date(solvedLog.created_at) > deadline;
    return false;
  }
  return new Date() > deadline;
}

export function getOverdueSetting(ticketId: string, overdueSettings: OverdueSetting[]) {
  return overdueSettings.find((o) => o.ticket_id === ticketId);
}

export type ProjectReminderRef = {
  due_date: string; assign_name: string; assigned_to: string;
  category: string; warranty_years?: number | null;
};

export function getWarrantyInfo(projectName: string, projectReminders: Record<string, ProjectReminderRef[]>) {
  const key = (projectName || "").trim().toLowerCase();
  const refs = projectReminders[key];
  if (!refs || refs.length === 0) return null;
  const withWarranty = refs.filter(r => r.warranty_years);
  const best = withWarranty.length > 0
    ? withWarranty.reduce((a, b) => (a.due_date > b.due_date ? a : b))
    : refs.reduce((a, b) => (a.due_date > b.due_date ? a : b));
  if (!best.warranty_years || !best.due_date) return null;
  const wy = best.warranty_years as number;
  const expiry = new Date(best.due_date + "T00:00:00");
  expiry.setFullYear(expiry.getFullYear() + wy);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isIn = today <= expiry;
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  const bastStr = new Date(best.due_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const expiryStr = expiry.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return { isIn, diffDays, wy, bastStr, expiryStr, assignName: best.assign_name, category: best.category };
}

export function adalahPending(st: string | undefined | null): boolean {
  return (st ?? '').startsWith('Pending');
}

export function bolehUpdateTicket(t: Ticket, currentUser: User | null): boolean {
  return !!currentUser && (
    currentUser.role === 'admin' || currentUser.role === 'superadmin'
    || hasFullAccess(currentUser)
    || t.assign_name === currentUser.full_name
  );
}

export const TICKET_ADMIN_FIELDS: AdminField[] = [
  { key: 'project_name',   label: 'Nama Project',    span: 2 },
  { key: 'date',           label: 'Tanggal',         type: 'date' },
  { key: 'sales_name',     label: 'Sales',           span: 1 },
  { key: 'sales_division', label: 'Divisi Sales',    span: 1 },
  { key: 'customer_phone', label: 'Telepon Customer', type: 'tel' },
  { key: 'address',        label: 'Alamat',          span: 3 },
  { key: 'issue_case',     label: 'Issue / Kasus',   span: 3 },
  { key: 'description',    label: 'Deskripsi',       type: 'textarea', span: 3 },
  { key: 'sn_unit',        label: 'Serial Number' },
  { key: 'product',        label: 'Produk' },
  { key: 'priority',       label: 'Prioritas', type: 'select',
    options: ['Low', 'Medium', 'High', 'Critical'].map(v => ({ value: v, label: v })) },
  { key: 'status',         label: 'Status', type: 'select',
    options: ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Solved', 'Rejected'].map(v => ({ value: v, label: v })) },
  { key: 'current_team',   label: 'Team Penanganan', type: 'select',
    options: namaSemuaKelompokTim().map(v => ({ value: v, label: v })) },
  { key: 'brand',          label: 'Brand', type: 'select',
    options: BRAND_OPTIONS.map(b => ({ value: b.value, label: b.label })) },
];

export function bolehReroute(t: Ticket): boolean {
  if (['Call', 'Onsite', 'In Progress', 'Solved', 'Rejected'].includes(t.status)) return false;
  const ss = t.services_status ?? '';
  if (ss && !['Waiting Approval', 'Pending'].includes(ss)) return false;
  return true;
}
