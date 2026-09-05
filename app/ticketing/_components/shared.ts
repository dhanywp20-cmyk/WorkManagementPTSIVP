import { supabase } from '@/lib/supabase';
import { hasFullAccess } from '@/lib/constants';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import type { AdminField } from '@/lib/admin-edit';

// WA notif terpusat di lib/wa.ts - re-export agar call-site lama tetap jalan.
export { sendWANotif } from '@/lib/wa';

// Hierarki jabatan & aturan CC - satu sumber kebenaran di lib/jabatan.ts,
// diimpor (bukan cuma re-export) karena JABATAN_CC_RULES juga dipakai
// langsung di fetchWACCTargets di bawah ini. Dilonggarkan ke Record<string,...>
// di sini karena diindeks dengan jabatan dinamis (kolom users.jabatan, tipe
// string biasa) - lib/jabatan.ts sendiri tetap ketat (Record<JabatanType,...>).
import { JABATAN_TIER, JABATAN_CC_RULES as JABATAN_CC_RULES_KETAT } from '@/lib/jabatan';
const JABATAN_CC_RULES: Record<string, string[]> = JABATAN_CC_RULES_KETAT;
export { JABATAN_TIER, JABATAN_CC_RULES };

// CC ke atasan berdasarkan jabatan tier + IVP handler
// userId  = id user yang trigger event (untuk lookup jabatan mereka)
// salesDiv = sales_division user (untuk lookup IVP handler)
export async function fetchWACCTargets(
  userId: string,
  salesDiv: string
): Promise<{ phone: string; name: string; relation: string }[]> {
  const targets: { phone: string; name: string; relation: string }[] = [];
  try {
    // 1. Ambil jabatan user ybs
    const { data: userData } = await supabase.from("users").select("jabatan").eq("id", userId).maybeSingle();
    const jabatan = userData?.jabatan as string | undefined;

    if (jabatan && JABATAN_CC_RULES[jabatan]) {
      const ccJabatanList = JABATAN_CC_RULES[jabatan];
      if (ccJabatanList.length > 0) {
        // 2. Ambil user dengan jabatan yang masuk list CC, dari divisi yang sama
        //    Prioritas: div_supervisor_mappings  semua atasan yang terdaftar untuk divisi ini
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

        // 3. Juga ambil dari user_supervisor_mappings (per-user mapping manual)
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

    // 4. IVP handler untuk divisi ini
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

// Status list khusus Team Services
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
  // Routing: tahap Supervisor (Admin approve  SPV assign) + CC Sales Internal.
  routing_status?: string | null;          // 'supervisor_assign' | null
  assigned_supervisor_id?: string | null;  // Supervisor yg wajib assign lanjut ke tim
  internal_sales_id?: string | null;       // Sales Internal yg di-CC (informational, bukan gate)
  internal_sales_id_2?: string | null;     // Sales Internal kedua (brand IVP saat BOTH)
  brand?: string | null;                   // 'MVI' | 'IVP' | 'BOTH' - brand yg dipilih Sales External
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

// Helper Functions
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

// Penanganan tiket dari sudut pandang Team PTS IVP
/**
 * Satu tiket bisa berpindah tangan ke Team Services, dan itu dulu membuat tiga
 * hal salah tampil - di layar View Ticket maupun di laporan cetak:
 *
 *   1. Baris "Team" memakai current_team. Padahal current_team menyatakan tiket
 *      sedang ADA DI MANA, bukan siapa yang mengerjakannya. Akibatnya handler
 *      PTS tercetak seolah anggota Team Services.
 *   2. Status "Solved" berdiri sendiri tanpa keterangan, padahal pekerjaannya
 *      diteruskan pihak lain - pembacanya mengira selesai sepenuhnya di PTS.
 *   3. Lembar tanda tangan hanya bertuliskan "Tanda Tangan", tidak menyebut
 *      siapa yang bertanggung jawab.
 *
 * Aturannya ditaruh di sini, satu tempat, supaya layar dan cetakan tidak
 * pernah menjawab berbeda untuk tiket yang sama.
 */
export const TEAM_PTS = "Team PTS IVP";
export const TEAM_SERVICES = "Team Services";

export interface RingkasPenanganan {
  /** Nama orang Team PTS yang terakhir memegang tiket - yang menandatangani. */
  handlerPTS: string;
  /** Team si penanda tangan. Selalu Team PTS IVP, apa pun isi current_team. */
  teamHandler: string;
  /** Tiket ini pernah dilimpahkan ke Team Services. */
  keServices: boolean;
  /** Imbuhan keterangan, kosong bila tidak pernah dilimpahkan. */
  catatanServices: string;
  /** Status PTS beserta keterangan pelimpahannya, siap ditampilkan. */
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

  // assign_name memang sengaja TIDAK diubah saat pelimpahan (lihat
  // handleAddActivity: "assign_name TETAP handler PTS terakhir"), jadi ia sudah
  // berisi orang yang tepat. Activity log dipakai sebagai cadangan untuk tiket
  // lama yang assign_name-nya terlanjur kosong.
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

// Warna badge status - satu peta dipakai di seluruh halaman (kartu, tabel,
// popup detail, cetak).
export const statusColors: Record<string, string> = {
  "Waiting Approval": "bg-orange-50 text-orange-600 border-orange-200",
  Rejected: "bg-red-100 text-red-700 border-red-300",
  Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
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

export interface ReminderCronSchedule {
  hour_wib: string;
  minute: string;
  frequency: 'daily' | 'weekdays' | 'custom';
  custom_days: number[];
  active: boolean;
}

export function getCronDisplay(schedule: ReminderCronSchedule): string {
  const h = schedule.hour_wib.padStart(2, "0");
  const m = schedule.minute.padStart(2, "0");
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  let freq = "Setiap hari";
  if (schedule.frequency === "weekdays") freq = "Senin–Jumat";
  else if (schedule.frequency === "custom" && schedule.custom_days.length > 0) {
    freq = schedule.custom_days.map((d) => days[d]).join(", ");
  }
  return `${freq}, jam ${h}:${m} WIB`;
}

export type ProjectReminderRef = {
  due_date: string; assign_name: string; assigned_to: string;
  category: string; warranty_years?: number | null;
};

export function getWarrantyInfo(projectName: string, projectReminders: Record<string, ProjectReminderRef[]>) {
  const key = (projectName || "").trim().toLowerCase();
  const refs = projectReminders[key];
  if (!refs || refs.length === 0) return null;
  // Prioritaskan yang punya warranty_years, lalu ambil yang due_date paling baru
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

/**
 * "Pending" bukan satu status, melainkan beberapa: Pending, Pending Action,
 * dan Pending Check. Kartu ringkasan dulu mencocokkannya PERSIS dengan
 * "Pending" saja, sehingga ticket yang duduk di Pending Action tidak
 * terhitung di kartu mana pun - bukan pending, bukan in-progress, bukan
 * solved. Ia hilang begitu saja dari ringkasan, padahal justru status itulah
 * yang paling perlu ditindaklanjuti.
 */
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

/**
 * Field ticket yang boleh dibetulkan admin lewat panel Edit Detail. Sengaja
 * TIDAK memuat assign_name / routing_status / assigned_supervisor_id:
 * ketiganya milik bagian Re-route yang punya syarat (bolehReroute) dan efek
 * samping sendiri (WA ke penerima baru). Kalau ikut di sini, mengetik nama
 * di kotak teks bisa memindahkan pekerjaan orang tanpa ada yang diberi tahu.
 */
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
    options: ['Team PTS IVP', 'Team PTS MVI', 'Team PTS UMP', 'Team Services'].map(v => ({ value: v, label: v })) },
  { key: 'brand',          label: 'Brand', type: 'select',
    options: BRAND_OPTIONS.map(b => ({ value: b.value, label: b.label })) },
];

/**
 * Re-route hanya boleh selama pekerjaannya BELUM jalan.
 *
 * Begitu ticket melewati "Pending", sudah ada orang yang menelepon customer,
 * datang ke lokasi, atau mulai memperbaiki. Memindahkannya saat itu bukan
 * membetulkan salah route - itu membuang pekerjaan yang sudah terlanjur
 * dikerjakan, dan riwayatnya jadi menunjuk orang yang tidak mengerjakannya.
 */
export function bolehReroute(t: Ticket): boolean {
  if (['Call', 'Onsite', 'In Progress', 'Solved', 'Rejected'].includes(t.status)) return false;
  // Ticket yang sudah masuk alur Team Services punya tahapannya sendiri.
  const ss = t.services_status ?? '';
  if (ss && !['Waiting Approval', 'Pending'].includes(ss)) return false;
  return true;
}
